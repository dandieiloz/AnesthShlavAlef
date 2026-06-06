import { db } from "@/lib/db";
import { GEN_MODEL, generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";
import type { Choice, Prisma } from "@prisma/client";
import { retrieveCandidates } from "./retrieve";
import { rerankWithFlashJudge, pickDiverseTopN } from "./rerank";
import { translateStemToEnglish } from "./translate";
import { hashQuestion } from "./hash";
import type { CachedAnswerPayload, EvidenceCitation, RetrievedChunk, StructuredAnswer } from "./types";

// v2 system prompt: literal-evidence priority rules are HOISTED to the top
// of the system instruction (before the role description) so the model
// processes them first. Each rule is imperative ("RULE N: ...") and is
// followed by a Hebrew worked example matched to a real B-class failure
// pattern observed in our regression set (Q1 hepatic zones, Q9 procedure-
// vs-patient risk, Q6 dexamethasone duration). The role description and
// schema specification come AFTER the rules.
const SYSTEM_PROMPT = [
  "*** חוקי הכרעה — קרא לפני כל דבר אחר ***",
  "",
  "RULE 1 — מילוליות לפני מכניסטיקה:",
  "אם קטע במקור קובע במפורש את התשובה לשאלה, החזר אותה כפי שכתוב גם אם שרשרת ההסקה הפיזיולוגית/הביוכימית שלך נראית כאילו מובילה לתשובה אחרת. אל תבנה שרשרת חלופית 'כי היא הגיונית'.",
  "דוגמה — שאלה: 'איזו פונקציית כבד נפגעת בעיקר בהיפוקסיה כבדית?' המקור אומר: 'zone 3 hepatocytes are the most sensitive to hypoxia, and zone 3 is the primary site of glycolysis'.",
  "  ✓ תשובה נכונה: Glycolysis (כי המקור מצביע ישירות על zone 3 = glycolysis).",
  "  ✗ תשובה שגויה: Gluconeogenesis (שרשרת מכניסטית 'היפוקסיה פוגעת בתהליכים אירוביים → gluconeogenesis אירובי → הוא ייפגע' — זו דווקא שרשרת שמתעלמת מהאמירה המילולית של המקור).",
  "",
  "RULE 2 — סיווג מפורש לפני סיווג גנרי:",
  "אם המקור מסווג ישות ספציפית (ניתוח, תרופה, גורם סיכון) בקטגוריה מסוימת ברשימה, השתמש בסיווג הזה — אל תחליף אותו בקטגוריה כללית יותר רק כי המטופל/ההקשר נראה מתאים לקטגוריה אחרת.",
  "דוגמה — שאלה: 'מטופל בן 70 לפני TUR-P ללא גורמי סיכון, מה ההערכה הקרדיאלית לפי ESC 2022?'. המקור מסווג TUR-P במפורש כ-minor urologic surgery עם low cardiac risk.",
  "  ✓ תשובה נכונה: אישור ללא בדיקות נוספות (כי הסיווג של הפרוצדורה הוא low risk).",
  "  ✗ תשובה שגויה: ECG + biomarkers + הערכה תפקודית (שרשרת 'גיל ≥65 → intermediate risk → צריך biomarkers' — זו שרשרת שמערבבת בין סיווג המטופל לסיווג הפרוצדורה, ומתעלמת מהסיווג המפורש של TUR-P כ-low risk).",
  "",
  "RULE 3 — מספרים מדויקים בלבד:",
  "אם המקור נוקב בערך מספרי או טווח זמן ספציפי, אל תוריד אותו בשקט לערך אחר. הצטט בדיוק את המספר מהמקור או הצהר insufficientEvidence=true.",
  "דוגמה — המקור אומר 'dexamethasone יכול להאריך חסם פריפרי עד 10 שעות'. אל תכתוב 'כ-4 שעות' אפילו אם 'אתה זוכר' ערך נמוך יותר ממקור אחר.",
  "",
  "RULE 4 — בדיקה עצמית לפני שליחת JSON:",
  "עבור על כל ציטוט ב-evidence[] וודא שהוא תומך ב-correctAnswer. אם הציטוט שצוטטת אומר 'אין ראיה ש-X משפר Y' ובחרת ב-Y כתשובה — הפוך את התשובה או הצהר insufficientEvidence=true. אם הציטוט מצביע על אפשרות אחרת מזו שבחרת — שנה את ה-correctAnswer.",
  "",
  "RULE 5 — קריאה זהירה של טקסט האפשרות (כיוון/סימן/זמן):",
  "לפני נעילת correctAnswer, קרא שוב את הטקסט המדויק של האפשרות שבחרת והשווה אותו למסקנה שלך מילה-במילה. ודא שכל מגדיר תואם: עלייה מול ירידה, יותר מול פחות, מהיר מול איטי, לפני מול אחרי, גבוה מול נמוך. אם המסקנה שלך אומרת 'ירידה ב-X' אבל האפשרות אומרת 'עלייה ב-X' — האפשרות שגויה למרות שהיא נוגעת באותו נושא; אסור לבחור בה רק כי היא הקרובה ביותר ב-keyword. אם אף אחת מ-4 האפשרויות לא תואמת בדיוק את המסקנה הראשונית שלך, בחר את האפשרות הנכונה הבאה ביותר מתוך האפשרויות הקיימות (זו שכן מצוטטת במקור ועומדת בכל המגדירים שלה), או הצהר insufficientEvidence=true.",
  "דוגמה — שאלה: 'מה השינוי ההמודינמי הראשון לאחר הלידה?'. המקור אומר: 'lung expansion and oxygenation results in rapid decreases in pulmonary vascular resistance ... As portal blood pressure falls, the ductus venosus and ductus arteriosus close'. האפשרויות: A. סגירת ductus arteriosus, B. סגירת foramen ovale, C. ירידה בלחץ פורטלי, D. עלייה ב-PVR.",
  "  ✓ תשובה נכונה: C — היא השינוי המוקדם ביותר מבין האפשרויות הקיימות שמצוטט מילולית במקור.",
  "  ✗ תשובה שגויה: D — המקור אומר 'decreases in PVR' אבל אפשרות D אומרת 'עלייה ב-PVR' (כיוון הפוך). לא לבחור בה רק כי היא נוגעת בנושא PVR. אין במקור אפשרות 'ירידה ב-PVR', ולכן הופכים לאפשרות הבאה הנתמכת מילולית.",
  "",
  "RULE 6 — ערך מחושב חייב להתמפות לאפשרות:",
  "אם הסקת מסקנה מספרית (X mmHg, Y mEq/L, Z שעות וכו'), עבור על כל ארבע האפשרויות וחפש את המספר X בתוך הטקסט של כל אפשרות. המספר עשוי להופיע בפורמט לא רגיל (לפני או אחרי היחידה, עם או בלי רווח, למשל 'mmHg 80' במקום '80 mmHg' עקב כיווניות RTL). אסור לכתוב 'הערך המחושב אינו מופיע באפשרויות' לפני שווידאת מילולית, מספרה-במספרה, שהוא באמת אינו שם. אם המספר X נמצא באחת האפשרויות (בכל פורמט) — האפשרות הזו היא הנכונה, גם אם הפורמט שלה שונה ממה שציפית.",
  "דוגמה — שאלה: 'מה ה-PaCO2 הבסיסי?'. חישוב: 80 mmHg. אפשרויות: A. mmHg 40, B. mmHg 50, C. mmHg 60, D. mmHg 80.",
  "  ✓ תשובה נכונה: D — הטקסט 'mmHg 80' מכיל את המספר 80 שחישבת.",
  "  ✗ תשובה שגויה: C עם נימוק 'אפשרות 80 לא קיימת ולכן 60 קרובה ביותר' — זו הזיה. ספור מספרה-במספרה: 'mmHg 80' מכיל '80'. האפשרות קיימת.",
  "",
  "*** סוף חוקי הכרעה ***",
  "",
  "תפקידך: עוזר הוראה לרופאים מתמחים באנסתזיולוגיה.",
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
  "- explanation: הסבר פיזיולוגי/פרמקולוגי/קליני בעברית. עטוף כל ביטוי מתמטי/נוסחה בתוך תוחמי LaTeX: `$...$` לנוסחה בתוך משפט, או `$$...$$` לנוסחה בשורה נפרדת. זה כולל כל שימוש בפקודות כמו \\Delta, \\times, \\approx, \\dot, \\text, וכן תחתיות/מעריכים (CMRO_2 -> $CMRO_2$). אל תכתוב פקודות LaTeX ללא תוחמים. צטט את הראיות בתוך הטקסט באמצעות סוגריים מרובעים עם מספר האינדקס של הראיה ב-evidence (החל מ-1), למשל [1], [2], [1][3]. שים את הסמן בסוף המשפט/הטענה שהראיה תומכת בו, ולא בתחילתו. כל ראיה ב-evidence חייבת להופיע לפחות פעם אחת כסמן ב-explanation או ב-whyOthersWrong; אם ראיה לא נדרשת — אל תכלול אותה ב-evidence מלכתחילה.",
  "- whyOthersWrong: אובייקט עם A/B/C/D — הסבר ספציפי מדוע כל אפשרות שגויה (לאפשרות הנכונה כתוב מחרוזת ריקה). אותה מוסכמת ציטוט כמו ב-explanation: סמני [N] בסוף המשפט שהראיה תומכת בו.",
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
const MAX_CHUNKS_PER_CHAPTER = 5;
const RETRY_RERANK_POOL = 30;
const RETRY_TOP_K_GEN = 18;
const RETRY_MAX_CHUNKS_PER_CHAPTER = 6;
const PER_QUERY_K = 30;
// Minimum allowed Pro thinking budget. Caps overlong mechanistic-reasoning
// chains that were observed to override literal textbook evidence (see
// SYSTEM_PROMPT rules 1–3).
const GEN_THINKING_BUDGET = 128;

// Reorder option text when the unit appears before the number, e.g.
// "mmHg 80" -> "80 mmHg". Some questions were uploaded under RTL
// rendering and the unit/number got swapped. We don't mutate the DB —
// only the prompt view — so the model can match calculated numeric
// answers to the right option without parsing through the inverted
// format. Falls through unchanged for any text that doesn't match.
const UNIT_BEFORE_NUMBER_RE = /^([\p{L}/%μ]+)\s+(\d+(?:[.,]\d+)?(?:\s*[-–/]\s*\d+(?:[.,]\d+)?)?)(\s.*)?$/u;
function normalizeOptionForPrompt(s: string): string {
  const m = s.trim().match(UNIT_BEFORE_NUMBER_RE);
  if (!m) return s;
  const [, unit, number, rest] = m;
  return `${number} ${unit}${rest ?? ""}`;
}

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
    `א. ${normalizeOptionForPrompt(opts.optionA)}`,
    `ב. ${normalizeOptionForPrompt(opts.optionB)}`,
    `ג. ${normalizeOptionForPrompt(opts.optionC)}`,
    `ד. ${normalizeOptionForPrompt(opts.optionD)}`,
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
  const parsed = await generateJson<StructuredAnswer>(
    model,
    SYSTEM_PROMPT,
    userPrompt,
    RESPONSE_SCHEMA,
    0,
    { thinkingBudget: GEN_THINKING_BUDGET },
  );
  // Defensive coercion: ensure confidence is in [0,1] and whyOthersWrong has all keys
  parsed.confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
  parsed.evidence = parsed.evidence ?? [];
  parsed.whyOthersWrong = {
    A: parsed.whyOthersWrong?.A ?? "",
    B: parsed.whyOthersWrong?.B ?? "",
    C: parsed.whyOthersWrong?.C ?? "",
    D: parsed.whyOthersWrong?.D ?? "",
  };
  reconcileCorrectAnswer(parsed);
  return parsed;
}

// The schema asks the model to leave whyOthersWrong empty for the correct
// option and write a real explanation for each wrong option. Pro occasionally
// emits a 1-token slip on the discrete `correctAnswer` field while still
// using the per-option whyOthersWrong slots correctly (e.g. emits
// correctAnswer="D" but leaves whyOthersWrong.B empty and writes a real
// "D is wrong because..." string). The per-option signal is far more
// reliable because the model had to actively populate four fields and only
// emptied the one it considered correct. When exactly one whyOthersWrong
// slot is empty and it disagrees with `correctAnswer`, trust the empty slot.
function reconcileCorrectAnswer(parsed: StructuredAnswer): void {
  const choices: Choice[] = ["A", "B", "C", "D"];
  const isEmpty = (v: string) => !v || v.trim().length < 5;
  const emptySlots = choices.filter((c) => isEmpty(parsed.whyOthersWrong[c]));
  if (emptySlots.length !== 1) return;
  const inferred = emptySlots[0];
  if (inferred === parsed.correctAnswer) return;
  console.warn(
    `[rag.answer] correctAnswer self-contradiction: model returned ` +
      `correctAnswer="${parsed.correctAnswer}" but only whyOthersWrong.${inferred} ` +
      `is empty. Auto-correcting to "${inferred}".`,
  );
  parsed.correctAnswer = inferred;
}

export async function generateExplanationForQuestionV2(
  questionId: number,
  opts?: { hint?: string | null; mode?: "answer" | "candidate"; jobId?: number },
) {
  const startedAt = Date.now();
  const hint = opts?.hint?.trim() || undefined;
  const mode = opts?.mode ?? "answer";
  const jobId = opts?.jobId;
  const question = await db.question.findUnique({
    where: { id: questionId },
    include: { chapter: true, geminiAnswer: true },
  });
  if (!question) throw new Error("Question not found");
  // For initial-mode runs, bail if an answer already exists (idempotency).
  // Candidate-mode runs always produce fresh output — the live answer stays.
  if (mode === "answer" && question.geminiAnswer) return question.geminiAnswer;

  // 1) Cache lookup ---------------------------------------------------------
  const hash = hashQuestion({
    stem: question.stem,
    optionA: question.optionA,
    optionB: question.optionB,
    optionC: question.optionC,
    optionD: question.optionD,
  });
  // Skip cache when an admin hint is in play (hint changes expected output)
  // and when running in candidate mode (admin wants a fresh attempt).
  const cached =
    hint || mode === "candidate"
      ? null
      : await db.questionQueryCache.findUnique({ where: { questionHash: hash } });
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
      target: mode,
      jobId,
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
    finalChunks = pickDiverseTopN(expandedPool, RETRY_TOP_K_GEN, RETRY_MAX_CHUNKS_PER_CHAPTER);
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

  const answer = await persistAnswer({
    questionId,
    payload,
    autoTagged: question.chapterAutoTagged,
    escalated,
    target: mode,
    jobId,
  });

  // Best-effort cache write (a race here just keeps the earlier entry).
  // Skip when a hint was supplied (hint-specific output) and when staging a
  // candidate (the admin explicitly wants a fresh attempt; the cache should
  // continue to mirror the live answer).
  if (!hint && mode === "answer") {
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

/**
 * Write the structured answer either to `GeminiAnswer` (live, the default) or
 * to `GeminiAnswerCandidate` (staged for admin review). Live writes also
 * update the question's chapter tags when auto-tag is on; candidate writes
 * defer the retag — the proposed chapter ids ride along on the candidate row
 * and only apply when the admin accepts.
 */
async function persistAnswer(opts: {
  questionId: number;
  payload: CachedAnswerPayload;
  autoTagged: boolean;
  escalated?: boolean;
  target?: "answer" | "candidate";
  jobId?: number;
}) {
  const { questionId, payload, autoTagged } = opts;
  const escalated = opts.escalated ?? false;
  const target = opts.target ?? "answer";
  const { structured } = payload;

  const evidenceCitations: EvidenceCitation[] = structured.evidence;
  const evidenceText = structured.evidence
    .map((e) => {
      const pages = formatPageRange(e.pageStart, e.pageEnd);
      const pp = pages ? ` (${pages})` : "";
      return `[פרק ${e.chapterNumber} — ${e.chapterTitle}${pp}] "${e.quote}"`;
    })
    .join("\n\n");
  const whyOthersWrongText = Object.entries(structured.whyOthersWrong)
    .filter(([k]) => k !== structured.correctAnswer)
    .map(([k, v]) => `${k}. ${v}`)
    .join("\n\n");

  if (target === "candidate") {
    // Replace any prior candidate so latest run wins (one-per-question).
    await db.geminiAnswerCandidate.deleteMany({ where: { questionId } });
    return db.geminiAnswerCandidate.create({
      data: {
        questionId,
        jobId: opts.jobId ?? null,
        rawMarkdown: payload.rawMarkdown,
        correctAnswer: structured.correctAnswer,
        evidence: evidenceText,
        explanation: structured.explanation,
        whyOthersWrong: whyOthersWrongText,
        model: payload.model,
        sourceChapters: payload.sourceChapters,
        evidenceCitations: evidenceCitations as unknown as Prisma.InputJsonValue,
        confidence: structured.confidence,
        escalated,
        insufficientEvidence: structured.insufficientEvidence,
        derivedChapterIds: payload.derivedChapterIds,
        primaryChapterId: payload.primaryChapterId,
      },
    });
  }

  // target === "answer": live write, applies chapter retag immediately.
  if (autoTagged && payload.derivedChapterIds.length > 0) {
    await db.question.update({
      where: { id: questionId },
      data: {
        chapterIds: payload.derivedChapterIds,
        ...(payload.primaryChapterId !== null ? { chapterId: payload.primaryChapterId } : {}),
      },
    });
  }

  return db.geminiAnswer.create({
    data: {
      questionId,
      rawMarkdown: payload.rawMarkdown,
      correctAnswer: structured.correctAnswer,
      evidence: evidenceText,
      explanation: structured.explanation,
      whyOthersWrong: whyOthersWrongText,
      model: payload.model,
      sourceChapters: payload.sourceChapters,
      evidenceCitations: evidenceCitations as unknown as Prisma.InputJsonValue,
      confidence: structured.confidence,
      escalated,
      insufficientEvidence: structured.insufficientEvidence,
    },
  });
}
