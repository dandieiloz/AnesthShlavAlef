"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Choice } from "@prisma/client";
import { ProfileSchema } from "@/app/onboarding/schema";
import { getContentLocale } from "@/lib/locale";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere, assertCanAccessQuestion, hasUsableAnswerWhere } from "@/lib/plan";
import { addQuestionReply, editReply, deleteReply } from "@/lib/forum";
import { OFFICIAL_EXAM_SOURCE } from "@/lib/hospitals";
import { getScoreById } from "@/lib/scores/registry";
import { loadQuizBatch, type QuizBatch, type QuestionPayload } from "@/app/quiz/[id]/quiz-session";
import type { EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { getAnswerDistribution, type AnswerDistribution } from "@/lib/answer-distribution";
export async function updateProfileAction(formData: FormData) {
  const me = await requireUser();
  const data = ProfileSchema.parse({
    fullName: formData.get("fullName"),
    hospitalName: formData.get("hospitalName"),
    residencyYear: formData.get("residencyYear"),
    marketingOptIn: formData.get("marketingOptIn"),
  });
  const current = await db.user.findUnique({
    where: { id: me.id },
    select: { marketingOptIn: true, marketingOptInAt: true },
  });
  const wasOptedIn = current?.marketingOptIn ?? false;
  const marketingOptInAt = data.marketingOptIn
    ? wasOptedIn
      ? (current?.marketingOptInAt ?? new Date())
      : new Date()
    : null;
  await db.user.update({
    where: { id: me.id },
    data: {
      fullName: data.fullName,
      hospitalName: data.hospitalName,
      residencyYear: data.residencyYear,
      marketingOptIn: data.marketingOptIn,
      marketingOptInAt,
    },
  });
  revalidatePath("/profile");
}

/**
 * Records whether the current user has a local textbook PDF configured.
 * The PDF handle itself lives only in the browser (IndexedDB), so the client
 * reports its presence here purely so admins can see who has set one up.
 */
export async function setLocalPdfStateAction(hasPdf: boolean) {
  const me = await requireUser();
  await db.user.update({
    where: { id: me.id },
    data: { localPdfSetAt: hasPdf ? new Date() : null },
  });
}

const ConfidenceSchema = z.object({
  scoreId: z.string().min(1).max(64),
  level: z.enum(["CONFIDENT", "OK", "WEAK"]),
});

/**
 * Upserts the current user's self-rated confidence for a clinical score.
 * The scoring-drill mode does no objective logging — only the learner's own
 * confidence rating is stored, so they can target weak scores later.
 */
export async function rateScoreConfidenceAction(input: {
  scoreId: string;
  level: "CONFIDENT" | "OK" | "WEAK";
}) {
  const me = await requireUser();
  const { scoreId, level } = ConfidenceSchema.parse(input);
  // Only accept registered scores; ignore arbitrary ids.
  if (!getScoreById(scoreId)) return;
  await db.scoreConfidence.upsert({
    where: { userId_scoreId: { userId: me.id, scoreId } },
    create: { userId: me.id, scoreId, level },
    update: { level },
  });
  revalidatePath("/study");
}

/**
 * Increments the current user's lifetime count of scoring-drill questions
 * answered. This is a plain counter — no per-question outcome is stored.
 */
export async function incrementScoreDrillSolvedAction() {
  const me = await requireUser();
  await db.user.update({
    where: { id: me.id },
    data: { scoreDrillSolved: { increment: 1 } },
  });
}

const QuizSchema = z.object({
  name: z.string().min(1).max(200),
  chapterIds: z.array(z.coerce.number()).min(1),
  questionLimit: z.coerce.number().int().min(1).optional(),
  includeSeen: z.boolean().optional().default(false),
  excludeOfficial: z.boolean().optional().default(false),
});

const QuizExamSchema = z.object({
  name: z.string().min(1).max(200),
  sourceInstitution: z.string().min(1).max(200),
  sourceYear: z.string().min(4).max(50), // "2024" or "2024 א"
  questionLimit: z.coerce.number().int().min(1).optional(),
  includeSeen: z.boolean().optional().default(false),
});

/**
 * Sample question ids for a new quiz, prioritizing questions with the fewest
 * total attempts across all users. Questions are ordered by their global
 * attempt count ascending (so never-attempted questions come first, then
 * least-attempted, and so on), with a random shuffle within each equal-count
 * tier to keep variety. The result is sliced to `limit`, so the quiz fills up
 * with the globally least-answered questions available in the pool.
 */
async function samplePrioritizingUntested(poolIds: number[], limit: number): Promise<number[]> {
  if (poolIds.length === 0) return [];
  const grouped = await db.attempt.groupBy({
    by: ["questionId"],
    where: { questionId: { in: poolIds } },
    _count: { questionId: true },
  });
  const countById = new Map(grouped.map((g) => [g.questionId, g._count.questionId]));
  const ranked = poolIds
    .map((id) => ({ id, count: countById.get(id) ?? 0, r: Math.random() }))
    .sort((a, b) => a.count - b.count || a.r - b.r);
  return ranked.map((x) => x.id).slice(0, Math.min(limit, poolIds.length));
}

async function resolveUniqueName(userId: string, baseName: string): Promise<string> {
  const existing = await db.quiz.findMany({ where: { userId }, select: { name: true } });
  const names = new Set(existing.map((q) => q.name));
  if (!names.has(baseName)) return baseName;
  let i = 2;
  while (names.has(`${baseName} (${i})`)) i++;
  return `${baseName} (${i})`;
}

export async function createQuizAction(formData: FormData) {
  const me = await requireUser();
  const raw = formData.get("questionLimit");
  const mode = formData.get("mode") === "exam" ? "exam" : "chapters";

  if (mode === "exam") {
    const data = QuizExamSchema.parse({
      name: formData.get("name") || "מבחן",
      sourceInstitution: formData.get("sourceInstitution"),
      sourceYear: formData.get("sourceYear"),
      questionLimit: raw && String(raw).trim() !== "" ? raw : undefined,
      includeSeen: formData.get("includeSeen") === "1",
    });

    const planGate = await questionAccessWhere(me);
    const attemptedIds = data.includeSeen
      ? []
      : (
          await db.attempt.findMany({
            where: { userId: me.id },
            select: { questionId: true },
            distinct: ["questionId"],
          })
        ).map((a) => a.questionId);
    const sourceValue = `${data.sourceInstitution} ${data.sourceYear}`;
    const pool = await db.question.findMany({
      where: {
        source: sourceValue,
        id: { notIn: attemptedIds },
        AND: [planGate, hasUsableAnswerWhere],
      },
      select: { id: true },
      orderBy: { id: "asc" },
    });

    if (pool.length === 0) {
      const q = new URLSearchParams({
        empty: "1",
        mode: "exam",
        inst: data.sourceInstitution,
        year: String(data.sourceYear),
      });
      redirect(`/study/new?${q.toString()}`);
    }

    // A full institutional exam is delivered in its natural question order:
    // no prioritization and no shuffle, just the exam sequence.
    const questionIds = pool
      .map((q) => q.id)
      .slice(0, data.questionLimit ?? pool.length);

    const resolvedName = await resolveUniqueName(me.id, data.name);
    const quiz = await db.quiz.create({
      data: { userId: me.id, name: resolvedName, chapterIds: [], questionIds },
    });
    redirect(`/quiz/${quiz.id}`);
  }

  const data = QuizSchema.parse({
    name: formData.get("name") || "מבחן",
    chapterIds: formData.getAll("chapterIds").map(String),
    questionLimit: raw && String(raw).trim() !== "" ? raw : undefined,
    includeSeen: formData.get("includeSeen") === "1",
    excludeOfficial: formData.get("excludeOfficial") === "1",
  });

  const planGate = await questionAccessWhere(me);
  const attemptedIds = data.includeSeen
    ? []
    : (
        await db.attempt.findMany({
          where: { userId: me.id },
          select: { questionId: true },
          distinct: ["questionId"],
        })
      ).map((a) => a.questionId);
  const pool = await db.question.findMany({
    where: {
      chapterIds: { hasSome: data.chapterIds },
      id: { notIn: attemptedIds },
      AND: [
        planGate,
        hasUsableAnswerWhere,
        ...(data.excludeOfficial
          ? [{ NOT: { source: { startsWith: OFFICIAL_EXAM_SOURCE } } }]
          : []),
      ],
    },
    select: { id: true },
  });

  if (pool.length === 0) {
    redirect("/study/new?empty=1");
  }

  const questionIds = await samplePrioritizingUntested(
    pool.map((q) => q.id),
    data.questionLimit ?? pool.length,
  );

  const resolvedName = await resolveUniqueName(me.id, data.name);

  const quiz = await db.quiz.create({
    data: { userId: me.id, name: resolvedName, chapterIds: data.chapterIds, questionIds },
  });
  redirect(`/quiz/${quiz.id}`);
}

/**
 * Lightweight, non-revalidating attempt-recording action used by the
 * client-driven quiz runner. Records the attempt and returns correctness; the
 * client already has the next question buffered, so we deliberately skip
 * revalidatePath to avoid a full RSC refetch of /quiz/:id.
 */
const RecordAttemptSchema = z.object({
  quizId: z.number().int(),
  questionId: z.number().int(),
  chosen: z.enum(["A", "B", "C", "D"]),
  eliminated: z.array(z.enum(["A", "B", "C", "D"])).max(4).default([]),
});
export async function recordAttemptAction(input: {
  quizId: number;
  questionId: number;
  chosen: "A" | "B" | "C" | "D";
  eliminated?: ("A" | "B" | "C" | "D")[];
}): Promise<{ ok: true; isCorrect: boolean }> {
  const me = await requireUser();
  const data = RecordAttemptSchema.parse(input);
  await assertCanAccessQuestion(me, data.questionId);
  const q = await db.question.findUnique({
    where: { id: data.questionId },
    select: {
      correctAnswer: true,
      acceptedAnswers: true,
      geminiAnswer: { select: { correctAnswer: true } },
    },
  });
  const correctAnswer = q?.geminiAnswer?.correctAnswer ?? q?.correctAnswer ?? null;
  if (!correctAnswer) throw new Error("No cached answer for question");
  const accepted: Choice[] = q?.acceptedAnswers ?? [];
  const isCorrect = data.chosen === correctAnswer || accepted.includes(data.chosen as Choice);

  // Dedupe rapid duplicate submissions (key-repeat, double-click, React state lag,
  // server-action retries). If the same user already recorded an attempt for this
  // (quiz, question, chosen) within the last 10s, treat it as the same submission.
  const recent = await db.attempt.findFirst({
    where: {
      userId: me.id,
      quizId: data.quizId,
      questionId: data.questionId,
      chosen: data.chosen as Choice,
      createdAt: { gte: new Date(Date.now() - 10_000) },
    },
    select: { id: true },
  });
  if (!recent) {
    await db.attempt.create({
      data: {
        userId: me.id,
        quizId: data.quizId,
        questionId: data.questionId,
        chosen: data.chosen as Choice,
        isCorrect,
        eliminated: data.eliminated as Choice[],
      },
    });
  }
  return { ok: true, isCorrect };
}

/**
 * Returns the per-option answer distribution (A/B/C/D attempt counts) for a
 * single question. Called by the quiz runner after the answer is revealed so
 * the histogram can include every attempt, including the user's own. Access is
 * gated identically to the question itself.
 */
export async function getAnswerDistributionAction(
  questionId: number,
): Promise<AnswerDistribution> {
  const me = await requireUser();
  await assertCanAccessQuestion(me, questionId);
  return getAnswerDistribution(questionId);
}

/**
 * Bulk-finalize a "full" mode quiz: client buffers answers locally during the
 * run, then submits the whole batch here. We compute correctness against
 * GeminiAnswer and insert one Attempt row per question, skipping any question
 * the user already has an attempt for in this quiz (idempotent against
 * accidental double-submits).
 */
const SubmitFullQuizSchema = z.object({
  quizId: z.number().int(),
  answers: z
    .array(
      z.object({
        questionId: z.number().int(),
        chosen: z.enum(["A", "B", "C", "D"]),
        eliminated: z.array(z.enum(["A", "B", "C", "D"])).max(4).default([]),
      }),
    )
    .min(1)
    .max(500),
});
export async function submitFullQuizAction(input: {
  quizId: number;
  answers: { questionId: number; chosen: "A" | "B" | "C" | "D"; eliminated?: ("A" | "B" | "C" | "D")[] }[];
}): Promise<{ ok: true; recorded: number; correct: number }> {
  const me = await requireUser();
  const data = SubmitFullQuizSchema.parse(input);

  const quiz = await db.quiz.findFirst({
    where: { id: data.quizId, userId: me.id },
    select: { id: true },
  });
  if (!quiz) throw new Error("Quiz not found");

  const questionIds = data.answers.map((a) => a.questionId);
  const [questions, existing] = await Promise.all([
    db.question.findMany({
      where: { id: { in: questionIds } },
      select: {
        id: true,
        acceptedAnswers: true,
        geminiAnswer: { select: { correctAnswer: true } },
      },
    }),
    db.attempt.findMany({
      where: { userId: me.id, quizId: quiz.id, questionId: { in: questionIds } },
      select: { questionId: true },
    }),
  ]);

  const acceptedById = new Map<number, Set<Choice>>();
  for (const q of questions) {
    if (!q.geminiAnswer) continue;
    const set = new Set<Choice>([q.geminiAnswer.correctAnswer, ...q.acceptedAnswers]);
    acceptedById.set(q.id, set);
  }
  const alreadyRecorded = new Set(existing.map((a) => a.questionId));

  const rows: { userId: string; quizId: number; questionId: number; chosen: Choice; isCorrect: boolean; eliminated: Choice[] }[] = [];
  let correctCount = 0;
  for (const a of data.answers) {
    if (alreadyRecorded.has(a.questionId)) continue;
    const set = acceptedById.get(a.questionId);
    if (!set) continue;
    const isCorrect = set.has(a.chosen as Choice);
    if (isCorrect) correctCount++;
    rows.push({
      userId: me.id,
      quizId: quiz.id,
      questionId: a.questionId,
      chosen: a.chosen as Choice,
      isCorrect,
      eliminated: a.eliminated as Choice[],
    });
  }

  if (rows.length > 0) {
    await db.attempt.createMany({ data: rows });
  }
  return { ok: true, recorded: rows.length, correct: correctCount };
}

/**
 * Fetch the next batch of unanswered questions for an active quiz. Used by
 * the client runner to refill its in-memory queue in the background while the
 * user is still on the current question.
 */
const LoadBatchSchema = z.object({
  quizId: z.number().int(),
  excludeIds: z.array(z.number().int()).max(2000).default([]),
  count: z.number().int().min(1).max(20).default(5),
});
export async function loadQuizBatchAction(input: {
  quizId: number;
  excludeIds: number[];
  count?: number;
}): Promise<QuizBatch> {
  const me = await requireUser();
  const data = LoadBatchSchema.parse(input);
  const quiz = await db.quiz.findFirst({
    where: { id: data.quizId, userId: me.id },
    select: { id: true, chapterIds: true, questionIds: true },
  });
  if (!quiz) return { questions: [], hasMore: false };

  // Server-side answered IDs union with client-supplied excludes (latter
  // covers attempts the client just recorded that may not be visible yet
  // due to replica lag or in-flight transactions).
  const answered = await db.attempt.findMany({
    where: { userId: me.id, quizId: quiz.id },
    select: { questionId: true },
  });
  const excludeSet = new Set<number>(data.excludeIds);
  for (const a of answered) excludeSet.add(a.questionId);

  const locale = await getContentLocale();
  return loadQuizBatch({
    user: me,
    quiz,
    excludeIds: Array.from(excludeSet),
    contentLocale: locale,
    batchSize: data.count,
  });
}

/**
 * Background prefetch of a question's translation (stem + 4 options + answer fields)
 * for the user's current locale. Called from the client while the user is reading
 * the current question so the NEXT question's render is instant.
 *
 * Idempotent: hits the translation cache if already populated.
 */
export async function prefetchQuestionTranslationAction(questionId: number): Promise<void> {
  const me = await requireUser();
  await assertCanAccessQuestion(me, questionId);
  const locale = await getContentLocale();
  if (locale === "he") return;

  const q = await db.question.findUnique({
    where: { id: questionId },
    include: { geminiAnswer: true },
  });
  if (!q) return;

  await Promise.all([
    getTranslatedFields(
      "Question",
      String(q.id),
      { stem: q.stem, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD },
      locale,
    ),
    q.geminiAnswer
      ? getTranslatedFields(
          "GeminiAnswer",
          String(q.geminiAnswer.id),
          { explanation: q.geminiAnswer.explanation, whyOthersWrong: q.geminiAnswer.whyOthersWrong },
          locale,
        )
      : Promise.resolve(),
  ]);
}

const CommentSchema = z.object({
  questionId: z.coerce.number(),
  body: z.string().min(1).max(2000),
});

export async function postCommentAction(formData: FormData) {
  const me = await requireUser();
  const data = CommentSchema.parse({
    questionId: formData.get("questionId"),
    body: formData.get("body"),
  });
  await addQuestionReply(data.questionId, me.id, data.body);
  revalidatePath("/quiz/[id]/review", "page");
  revalidatePath("/history/[id]", "page");
  revalidatePath("/forum");
}

const EditCommentSchema = z.object({
  commentId: z.string().min(1),
  body: z.string().min(1).max(2000),
});

export async function editCommentAction(formData: FormData) {
  const me = await requireUser();
  const data = EditCommentSchema.parse({
    commentId: formData.get("commentId"),
    body: formData.get("body"),
  });
  await editReply(data.commentId, me.id, me.role, data.body);
  revalidatePath("/quiz/[id]/review", "page");
  revalidatePath("/history/[id]", "page");
  revalidatePath("/forum");
}

const DeleteCommentSchema = z.object({ commentId: z.string().min(1) });

export async function deleteCommentAction(formData: FormData) {
  const me = await requireUser();
  const { commentId } = DeleteCommentSchema.parse({ commentId: formData.get("commentId") });
  await deleteReply(commentId, me.id, me.role);
  revalidatePath("/quiz/[id]/review", "page");
  revalidatePath("/history/[id]", "page");
  revalidatePath("/forum");
}

const ReportSchema = z.object({
  questionId: z.coerce.number(),
  explanation: z.string().min(10).max(2000),
});

export async function reportAnswerAction(formData: FormData) {
  const me = await requireUser();
  const data = ReportSchema.parse({
    questionId: formData.get("questionId"),
    explanation: formData.get("explanation"),
  });
  await db.answerReport.create({
    data: { userId: me.id, questionId: data.questionId, explanation: data.explanation },
  });
}

// ── Bookmarks ────────────────────────────────────────────────────────────────

const BookmarkSchema = z.object({ questionId: z.coerce.number() });

export async function toggleBookmarkAction(formData: FormData) {
  const me = await requireUser();
  const { questionId } = BookmarkSchema.parse({ questionId: formData.get("questionId") });
  const existing = await db.bookmark.findUnique({
    where: { userId_questionId: { userId: me.id, questionId } },
    select: { id: true },
  });
  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } });
  } else {
    await db.bookmark.create({ data: { userId: me.id, questionId } });
  }
  revalidatePath("/bookmarks");
  revalidatePath("/study");
}

/**
 * Client-callable bookmark toggle that returns the new state without taking a
 * FormData. Used by the quiz runner for optimistic UI.
 */
export async function toggleBookmarkValueAction(questionId: number): Promise<{ bookmarked: boolean }> {
  const me = await requireUser();
  const id = z.number().int().parse(questionId);
  const existing = await db.bookmark.findUnique({
    where: { userId_questionId: { userId: me.id, questionId: id } },
    select: { id: true },
  });
  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } });
    revalidatePath("/bookmarks");
    revalidatePath("/study");
    return { bookmarked: false };
  }
  await db.bookmark.create({ data: { userId: me.id, questionId: id } });
  revalidatePath("/bookmarks");
  revalidatePath("/study");
  return { bookmarked: true };
}

// ── Quizzes ───────────────────────────────────────────────────────────────────

const DeleteQuizSchema = z.object({
  quizId: z.coerce.number(),
  resetQuestions: z
    .union([z.literal("on"), z.literal("true"), z.literal("1")])
    .optional()
    .transform((v) => v != null),
});

export async function deleteQuizAction(formData: FormData) {
  const me = await requireUser();
  const { quizId, resetQuestions } = DeleteQuizSchema.parse({
    quizId: formData.get("quizId"),
    resetQuestions: formData.get("resetQuestions") ?? undefined,
  });
  // Verify ownership before deleting
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, userId: me.id },
    select: { id: true, questionIds: true },
  });
  if (!quiz) return; // silently ignore if not owned by user
  if (resetQuestions && quiz.questionIds.length > 0) {
    await db.attempt.deleteMany({
      where: { userId: me.id, questionId: { in: quiz.questionIds } },
    });
  }
  await db.quiz.delete({ where: { id: quizId } });
  revalidatePath("/study");
  revalidatePath("/history");
  revalidatePath("/dashboard");
}

/**
 * Load a specific question and the user's attempt for it (if any).
 * Used for reviewing previously answered questions.
 */
export async function loadQuestionAttemptAction(
  quizId: number,
  questionId: number,
): Promise<{
  question: QuestionPayload;
  attempt: { chosen: "A" | "B" | "C" | "D"; isCorrect: boolean } | null;
} | null> {
  const me = await requireUser();

  // Verify user owns this quiz
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, userId: me.id },
    select: { id: true },
  });
  if (!quiz) return null;

  // Get the question
  const q = await db.question.findUnique({
    where: { id: questionId },
    include: { chapter: true, geminiAnswer: true },
  });
  if (!q) return null;

  // Verify access
  await assertCanAccessQuestion(me, questionId);

  // Get user's attempt for this question
  const attempt = await db.attempt.findFirst({
    where: { userId: me.id, quizId, questionId },
    select: { chosen: true, isCorrect: true },
  });

  const contentLocale = await getContentLocale();
  const planGate = await questionAccessWhere(me);

  // Fetch bookmarks, highlights, reports
  const [bookmarkRow, highlightRows, reportRows] = await Promise.all([
    db.bookmark.findFirst({
      where: { userId: me.id, questionId },
      select: { questionId: true },
    }),
    db.sentenceHighlight.findMany({
      where: { userId: me.id, questionId, locale: contentLocale },
      select: {
        id: true,
        questionId: true,
        section: true,
        sentenceIndex: true,
        colorId: true,
        sentenceHash: true,
        note: true,
      },
    }),
    db.answerReport.findMany({
      where: { userId: me.id, questionId },
      orderBy: { createdAt: "desc" },
      select: { questionId: true, status: true, adminResponse: true, createdAt: true },
    }),
  ]);

  const bookmarked = bookmarkRow != null;
  const latestReport = reportRows.length > 0 ? { status: reportRows[0].status as "OPEN" | "RESOLVED" | "REJECTED", adminResponse: reportRows[0].adminResponse } : null;
  const highlights = highlightRows.map((h) => ({
    id: h.id,
    section: h.section,
    sentenceIndex: h.sentenceIndex,
    colorId: h.colorId,
    sentenceHash: h.sentenceHash,
    note: h.note,
  }));

  const g = q.geminiAnswer;
  const [qFields, ansFields] = await Promise.all([
    getTranslatedFields(
      "Question",
      String(q.id),
      { stem: q.stem, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD },
      contentLocale,
    ),
    g
      ? getTranslatedFields(
          "GeminiAnswer",
          String(g.id),
          { explanation: g.explanation, whyOthersWrong: g.whyOthersWrong },
          contentLocale,
        )
      : Promise.resolve({ explanation: "", whyOthersWrong: "" }),
  ]);

  const question: QuestionPayload = {
    id: q.id,
    source: q.source,
    chapter: { number: q.chapter.number, title: q.chapter.title },
    stem: qFields.stem,
    optionA: qFields.optionA,
    optionB: qFields.optionB,
    optionC: qFields.optionC,
    optionD: qFields.optionD,
    imageUrl: q.imageUrl,
    imageAlt: q.imageAlt,
    videoUrl: q.videoUrl,
    answer: {
      correctAnswer: (g?.correctAnswer ?? q.correctAnswer!) as Choice,
      acceptedAnswers: (q.acceptedAnswers ?? []) as Choice[],
      explanation: g ? (ansFields.explanation || g.explanation) : "",
      whyOthersWrong: g ? (ansFields.whyOthersWrong || g.whyOthersWrong) : "",
      evidenceCitations: g
        ? ((g.evidenceCitations as EvidenceCitationDisplay[] | null) ?? null)
        : null,
      insufficientEvidence: g?.insufficientEvidence ?? false,
      explanationImageUrl: g?.explanationImageUrl ?? null,
      explanationImageAlt: g?.explanationImageAlt ?? null,
    },
    bookmarked,
    latestReport,
    highlights,
  };

  return {
    question,
    attempt: attempt ? { chosen: attempt.chosen, isCorrect: attempt.isCorrect } : null,
  };
}

export async function loadFullQuizProgressAction(quizId: number): Promise<{
  totalQ: number;
  answered: number;
  questions: Array<{ id: number; chapter: number; answered: boolean; stem: string }>;
}> {
  const me = await requireUser();
  const quiz = await db.quiz.findFirst({
    where: { id: quizId, userId: me.id },
    select: { chapterIds: true, questionIds: true },
  });
  if (!quiz) {
    throw new Error("Quiz not found");
  }

  const planGate = await questionAccessWhere(me);
  const useFixedSet = quiz.questionIds.length > 0;

  // Get all questions in this quiz
  const allQs = await db.question.findMany({
    where: useFixedSet
      ? { id: { in: quiz.questionIds }, AND: [planGate, hasUsableAnswerWhere] }
      : { chapterIds: { hasSome: quiz.chapterIds }, AND: [planGate, hasUsableAnswerWhere] },
    select: { id: true, stem: true, chapter: { select: { number: true } } },
    orderBy: { id: "asc" },
  });

  const totalQ = allQs.length;

  // Get all attempts for this quiz
  const attempts = await db.attempt.findMany({
    where: { userId: me.id, quizId },
    select: { questionId: true },
  });

  const answeredIds = new Set(attempts.map((a) => a.questionId));

  return {
    totalQ,
    answered: answeredIds.size,
    questions: allQs.map((q) => ({
      id: q.id,
      chapter: q.chapter.number,
      answered: answeredIds.has(q.id),
      stem: q.stem,
    })),
  };
}
