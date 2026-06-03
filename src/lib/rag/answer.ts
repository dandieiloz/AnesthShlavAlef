import { db } from "@/lib/db";
import { GEN_MODEL, generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";
import type { Choice, Prisma } from "@prisma/client";
import { retrieveCandidates } from "./retrieve";
import { rerankWithFlashJudge, pickDiverseTopN } from "./rerank";
import { translateStemToEnglish } from "./translate";
import { hashQuestion } from "./hash";
import type { CachedAnswerPayload, EvidenceCitation, RetrievedChunk, StructuredAnswer } from "./types";

/**
 * v2 system prompt: NO chapter hints. The model is told evidence may come
 * from any chapter and is required to cite which chapter it actually used
 * for each piece of evidence (these citations later drive the question's
 * derived chapter tags).
 */
const SYSTEM_PROMPT = [
  "אתה עוזר הוראה לרופאים מתמחים באנסתזיולוגיה.",
  "התשובות שלך מבוססות אך ורק על קטעי המקור המצורפים מספר Millers Anesthesia.",
  "הקטעים עשויים להגיע מפרקים שונים — אל תניח שהתשובה נמצאת בפרק כלשהו מראש.",
  "אם המידע אינו מופיע במקור המצורף, הגדר insufficientEvidence = true והסבר זאת.",
  "אסור להסתמך על ידע חיצוני שלך או על ספרי לימוד אחרים.",
  "",
  "החזר JSON בלבד לפי הסכמה. אין להחזיר Markdown או טקסט חופשי מחוץ ל-JSON.",
  "",
  "שדות נדרשים:",
  "- translation: תרגום קצר של השאלה והאפשרויות לעברית.",
  "- correctAnswer: A | B | C | D",
  "- confidence: מספר בין 0 ל-1, המבטא עד כמה אתה בטוח בתשובה על סמך הראיות.",
  "- evidence: מערך ראיות מסודר לפי חוזק — הראיה החזקה ביותר ראשונה. כל ראיה כוללת: chapterNumber, chapterTitle, sectionPath (אם ידוע, אחרת null), pageStart ו- pageEnd (מספרי העמוד בהדפסה להם מופיע הציטוט — מתוך תוית ה-pages של ה-CHAPTER block, אחרת null), quote (ציטוט קצר מהקטע).",
  "- explanation: הסבר פיזיולוגי/פרמקולוגי/קליני בעברית. עטוף כל ביטוי מתמטי/נוסחה בתוך תוחמי LaTeX: `$...$` לנוסחה בתוך משפט, או `$$...$$` לנוסחה בשורה נפרדת. זה כולל כל שימוש בפקודות כמו \\Delta, \\times, \\approx, \\dot, \\text, וכן תחתיות/מעריכים (CMRO_2 -> $CMRO_2$). אל תכתוב פקודות LaTeX ללא תוחמים.",
  "- whyOthersWrong: אובייקט עם A/B/C/D — הסבר ספציפי מדוע כל אפשרות שגויה (לאפשרות הנכונה כתוב מחרוזת ריקה).",
  "- insufficientEvidence: boolean. true רק אם באמת אין במקור מידע שמכריע.",
].join("\n");

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    translation: { type: Type.STRING },
    correctAnswer: { type: Type.STRING, enum: ["A", "B", "C", "D"] },
    confidence: { type: Type.NUMBER },
    evidence: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          chapterNumber: { type: Type.INTEGER, description: "Exact chapter number from the [CHAPTER N: ...] header of the source block that contains this quote" },
          chapterTitle: { type: Type.STRING },
          sectionPath: { type: Type.STRING, nullable: true },
          pageStart: { type: Type.INTEGER, nullable: true, description: "PDF page where the quote starts. Copy from the (pp. X-Y) marker on the source block. Use null if absent." },
          pageEnd: { type: Type.INTEGER, nullable: true, description: "PDF page where the quote ends. Copy from the (pp. X-Y) marker on the source block. Use null if absent." },
          quote: { type: Type.STRING },
        },
        required: ["chapterNumber", "chapterTitle", "quote"],
      },
    },
    explanation: { type: Type.STRING },
    whyOthersWrong: {
      type: Type.OBJECT,
      properties: {
        A: { type: Type.STRING },
        B: { type: Type.STRING },
        C: { type: Type.STRING },
        D: { type: Type.STRING },
      },
      required: ["A", "B", "C", "D"],
    },
    insufficientEvidence: { type: Type.BOOLEAN },
  },
  required: [
    "translation",
    "correctAnswer",
    "confidence",
    "evidence",
    "explanation",
    "whyOthersWrong",
    "insufficientEvidence",
  ],
};

// Generation runs on Pro directly (no cheap pass-1). The reranker still picks
// a wider candidate pool so we can enforce per-chapter diversity before
// passing chunks to the generator — the dominant cause of wrong answers was
// the top-K cluster being concentrated in a single chapter.
const RERANK_POOL = 25;        // top-N kept from the Flash judge
const TOP_K_GEN = 15;          // chunks actually sent to the generator
const MAX_CHUNKS_PER_CHAPTER = 3;
const RETRY_RERANK_POOL = 30;
const RETRY_TOP_K_GEN = 18;
const PER_QUERY_K = 30;

function buildUserPrompt(opts: {
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  chunks: RetrievedChunk[];
  hint?: string;
}): string {
  const sourceBlock = opts.chunks
    .map((c) => {
      const pages = formatPageRange(c.pageStart ?? null, c.pageEnd ?? null);
      const sec = c.sectionPath ? ` > ${c.sectionPath}` : "";
      const pp = pages ? ` (${pages})` : "";
      return `--- [CHAPTER ${c.chapterNumber}: ${c.chapterTitle}${sec}${pp}] ---\n${c.text}`;
    })
    .join("\n\n");

  const lines = [
    "שאלה:",
    opts.stem,
    "",
    `א. ${opts.optionA}`,
    `ב. ${opts.optionB}`,
    `ג. ${opts.optionC}`,
    `ד. ${opts.optionD}`,
    "",
    `להלן ${opts.chunks.length} קטעי מקור מספר הלימוד (ממספר פרקים). אלה הם היחידים שמותר להסתמך עליהם:`,
    sourceBlock,
  ];

  if (opts.hint && opts.hint.trim()) {
    lines.push(
      "",
      "--- הערת מהאדמין (חילול חוזר): ---",
      opts.hint.trim(),
      "--- סוף הערה ---",
      "הערה זו מסבירה למה התשובה הקודמת היתה שגויה או חלקית. התייחס אליה כרמז לכיוון, אך אל תסתמך עליה כראיה עצמאית — כל טענה חייבת להיתמך על קטעי המקור המצורפים.",
    );
  }

  return lines.join("\n");
}

/** Render a "p. N" or "pp. N–M" string, or empty when no pages are known. */
function formatPageRange(pageStart: number | null | undefined, pageEnd: number | null | undefined): string {
  if (!pageStart) return "";
  if (!pageEnd || pageEnd === pageStart) return `p. ${pageStart}`;
  return `pp. ${pageStart}–${pageEnd}`;
}

/** Render the structured payload back to a Hebrew Markdown block matching the legacy v1 format. */
function renderMarkdown(s: StructuredAnswer): string {
  const heLetter: Record<Choice, string> = { A: "א", B: "ב", C: "ג", D: "ד" };
  const evidenceBlock = s.evidence
    .map((e) => {
      const pages = formatPageRange(e.pageStart, e.pageEnd);
      const sec = e.sectionPath ? ` > ${e.sectionPath}` : "";
      const pp = pages ? `, ${pages}` : "";
      return `> "${e.quote}"\n> — פרק ${e.chapterNumber} — ${e.chapterTitle}${sec}${pp}`;
    })
    .join("\n\n");
  const wrongChoices: Choice[] = (["A", "B", "C", "D"] as Choice[]).filter((c) => c !== s.correctAnswer);
  const wrongBlock = wrongChoices
    .map((c) => `**${heLetter[c]}.** ${s.whyOthersWrong[c]}`)
    .join("\n\n");

  return [
    "**1. תרגום השאלה:**",
    s.translation,
    "",
    "**2. תשובה נכונה:**",
    `התשובה הנכונה היא ${heLetter[s.correctAnswer]}.`,
    "",
    "**3. ראיות מספר הלימוד:**",
    evidenceBlock || "_(לא צוטטו ראיות)_",
    "",
    "**4. הסבר מפורט:**",
    s.explanation,
    "",
    "**5. מדוע האפשרויות האחרות אינן נכונות:**",
    wrongBlock,
  ].join("\n");
}

/** Derive `chapterIds` (unranked set) and primary chapter (first evidence item) from the structured answer. */
async function deriveChapterTags(
  structured: StructuredAnswer,
): Promise<{ chapterIds: number[]; primaryChapterId: number | null }> {
  const numbers = [...new Set(structured.evidence.map((e) => e.chapterNumber))];
  if (numbers.length === 0) return { chapterIds: [], primaryChapterId: null };
  const chapters = await db.chapter.findMany({
    where: { number: { in: numbers } },
    select: { id: true, number: true },
  });
  const byNumber = new Map(chapters.map((c) => [c.number, c.id]));
  const chapterIds = numbers.map((n) => byNumber.get(n)).filter((x): x is number => typeof x === "number");
  const primaryNumber = structured.evidence[0]?.chapterNumber;
  const primaryChapterId =
    primaryNumber !== undefined ? (byNumber.get(primaryNumber) ?? null) : null;
  return { chapterIds, primaryChapterId };
}

async function runGenerationPass(
  model: string,
  chunks: RetrievedChunk[],
  question: {
    stem: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
  },
  hint?: string,
): Promise<StructuredAnswer> {
  const userPrompt = buildUserPrompt({ ...question, chunks, hint });
  const parsed = await generateJson<StructuredAnswer>(model, SYSTEM_PROMPT, userPrompt, RESPONSE_SCHEMA, 0.2);
  // Defensive coercion: ensure confidence is in [0,1] and whyOthersWrong has all keys
  parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  parsed.evidence = parsed.evidence ?? [];
  parsed.whyOthersWrong = {
    A: parsed.whyOthersWrong?.A ?? "",
    B: parsed.whyOthersWrong?.B ?? "",
    C: parsed.whyOthersWrong?.C ?? "",
    D: parsed.whyOthersWrong?.D ?? "",
  };
  return parsed;
}

export async function generateExplanationForQuestionV2(
  questionId: number,
  opts?: { hint?: string | null },
) {
  const startedAt = Date.now();
  const hint = opts?.hint?.trim() || undefined;
  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { chapter: true, geminiAnswer: true },
  });
  if (!question) throw new Error("Question not found");
  if (question.geminiAnswer) return question.geminiAnswer;

  // 1) Cache lookup ---------------------------------------------------------
  const hash = hashQuestion({
    stem: question.stem,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
  });
  // Skip cache entirely when an admin hint is in play — the hint changes the
  // expected output, and we don't want the hint-specific result to become the
  // default cached answer for this question fingerprint.
  const cached = hint ? null : await db.questionQueryCache.findUnique({ where: { questionHash: hash } });
  if (cached) {
    const payload = cached.payload as unknown as CachedAnswerPayload;
    await db.questionQueryCache.update({
      where: { questionHash: hash },
      data: { hits: { increment: 1 } },
    });
    const created = await persistAnswer({
      questionId,
      payload,
      autoTagged: question.chapterAutoTagged,
    });
    await db.ragRun.create({
      data: {
        questionId,
        model: payload.model,
        kPrimary: 0,
        kReranked: 0,
        rerankerScores: [],
        escalated: false,
        cacheHit: true,
        latencyMs: Date.now() - startedAt,
      },
    });
    return created;
  }

  // 2) Build queries (Hebrew original + English mirror) --------------------
  const hebrewQuery = [
    question.stem,
    "א.", question.optionA, "ב.", question.optionB, "ג.", question.optionC, "ד.", question.optionD,
  ].join(" ");
  let englishQuery = question.stemEn ?? null;
  if (!englishQuery) {
    try {
      englishQuery = await translateStemToEnglish(question.stem);
      // Persist for reuse; non-fatal if it fails.
      if (englishQuery) {
        await db.question.update({ where: { id: questionId }, data: { stemEn: englishQuery } });
      }
    } catch (e) {
      console.warn(`Stem translation failed: ${(e as Error).message}`);
    }
  }

  // 3) Retrieve ------------------------------------------------------------
  const candidates = await retrieveCandidates({
    hebrewQuery,
    englishQuery,
    perQueryK: PER_QUERY_K,
  });
  if (candidates.length === 0) {
    throw new Error("No chunks retrieved — make sure at least one chapter is ingested");
  }

  // 4) Rerank into a wider pool, then enforce per-chapter diversity -------
  const rerankedPool = await rerankWithFlashJudge(question.stem, candidates, RERANK_POOL);
  let finalChunks = pickDiverseTopN(rerankedPool, TOP_K_GEN, MAX_CHUNKS_PER_CHAPTER);

  // 5) Generate with Pro directly (no Flash pass-1) -----------------------
  const usedModel = GEN_MODEL;
  let structured = await runGenerationPass(GEN_MODEL, finalChunks, question, hint);
  let escalated = false;

  // 6) Last-resort retry: Pro reported insufficient evidence on this set.
  //    Expand retrieval with entity hints from the first pass and try a
  //    wider, still-diversified chunk set.
  if (structured.insufficientEvidence) {
    escalated = true;
    const entityHints = [
      ...structured.evidence.map((e) => e.quote).slice(0, 3),
      structured.explanation.slice(0, 300),
    ]
      .filter(Boolean)
      .join(" ");
    const expandedEnglish =
      englishQuery && entityHints ? `${englishQuery}\n${entityHints}` : englishQuery ?? entityHints;
    const expandedCandidates = await retrieveCandidates({
      hebrewQuery,
      englishQuery: expandedEnglish,
      perQueryK: PER_QUERY_K + 10,
    });
    const expandedPool = await rerankWithFlashJudge(
      question.stem,
      expandedCandidates,
      RETRY_RERANK_POOL,
    );
    finalChunks = pickDiverseTopN(expandedPool, RETRY_TOP_K_GEN, MAX_CHUNKS_PER_CHAPTER);
    structured = await runGenerationPass(GEN_MODEL, finalChunks, question, hint);
  }

  // 7) Persist + cache + observability ------------------------------------
  const { chapterIds, primaryChapterId } = await deriveChapterTags(structured);
  const sourceChapters = [...new Set(finalChunks.map((c) => c.chapterNumber))].sort((a, b) => a - b);

  const payload: CachedAnswerPayload = {
    rawMarkdown: renderMarkdown(structured),
    structured,
    model: usedModel,
    sourceChapters,
    derivedChapterIds: chapterIds,
    primaryChapterId,
  };

  const answer = await persistAnswer({ questionId, payload, autoTagged: question.chapterAutoTagged, escalated });

  // Best-effort cache write (a race here just keeps the earlier entry).
  // Skip when a hint was supplied so hint-specific output never becomes the
  // default cached answer.
  if (!hint) {
    await db.questionQueryCache.upsert({
      where: { questionHash: hash },
      create: { questionHash: hash, payload: payload as unknown as Prisma.InputJsonValue },
      update: {},
    });
  }

  await db.ragRun.create({
    data: {
      questionId,
      model: usedModel,
      kPrimary: candidates.length,
      kReranked: finalChunks.length,
      rerankerScores: finalChunks.map((c) => c.rerankScore ?? 0),
      escalated,
      cacheHit: false,
      latencyMs: Date.now() - startedAt,
    },
  });

  return answer;
}

/** Write the structured answer to GeminiAnswer + (optionally) update the question's chapter tags. */
async function persistAnswer(opts: {
  questionId: number;
  payload: CachedAnswerPayload;
  autoTagged: boolean;
  escalated?: boolean;
}) {
  const { questionId, payload, autoTagged } = opts;
  const escalated = opts.escalated ?? false;
  const { structured } = payload;

  // Only update question's chapter tags if admin hasn't overridden the auto-tag.
  if (autoTagged && payload.derivedChapterIds.length > 0) {
    await db.question.update({
      where: { id: questionId },
      data: {
        chapterIds: payload.derivedChapterIds,
        ...(payload.primaryChapterId !== null ? { chapterId: payload.primaryChapterId } : {}),
      },
    });
  }

  const evidenceCitations: EvidenceCitation[] = structured.evidence;
  return db.geminiAnswer.create({
    data: {
      questionId,
      rawMarkdown: payload.rawMarkdown,
      correctAnswer: structured.correctAnswer,
      evidence: structured.evidence
        .map((e) => {
          const pages = formatPageRange(e.pageStart, e.pageEnd);
          const pp = pages ? ` (${pages})` : "";
          return `[פרק ${e.chapterNumber} — ${e.chapterTitle}${pp}] "${e.quote}"`;
        })
        .join("\n\n"),
      explanation: structured.explanation,
      whyOthersWrong: Object.entries(structured.whyOthersWrong)
        .filter(([k]) => k !== structured.correctAnswer)
        .map(([k, v]) => `${k}. ${v}`)
        .join("\n\n"),
      model: payload.model,
      sourceChapters: payload.sourceChapters,
      evidenceCitations: evidenceCitations as unknown as Prisma.InputJsonValue,
      confidence: structured.confidence,
      escalated,
      insufficientEvidence: structured.insufficientEvidence,
    },
  });
}
