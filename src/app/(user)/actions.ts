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
import { questionAccessWhere, assertCanAccessQuestion } from "@/lib/plan";
import { loadQuizBatch, type QuizBatch } from "@/app/quiz/[id]/quiz-session";

export async function updateProfileAction(formData: FormData) {
  const me = await requireUser();
  const data = ProfileSchema.parse({
    fullName: formData.get("fullName"),
    hospitalName: formData.get("hospitalName"),
    residencyYear: formData.get("residencyYear"),
  });
  await db.user.update({
    where: { id: me.id },
    data,
  });
  revalidatePath("/profile");
}

const QuizSchema = z.object({
  name: z.string().min(1).max(200),
  chapterIds: z.array(z.coerce.number()).min(1),
  questionLimit: z.coerce.number().int().min(1).optional(),
  includeSeen: z.boolean().optional().default(false),
});

function fisherYatesSample<T>(arr: T[], n: number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.min(n, a.length));
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
  const data = QuizSchema.parse({
    name: formData.get("name") || "מבחן",
    chapterIds: formData.getAll("chapterIds").map(String),
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
  const pool = await db.question.findMany({
    where: {
      chapterIds: { hasSome: data.chapterIds },
      geminiAnswer: { isNot: null },
      id: { notIn: attemptedIds },
      AND: [planGate],
    },
    select: { id: true },
  });

  if (pool.length === 0) {
    redirect("/study/new?empty=1");
  }

  const questionIds = fisherYatesSample(
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
});
export async function recordAttemptAction(input: {
  quizId: number;
  questionId: number;
  chosen: "A" | "B" | "C" | "D";
}): Promise<{ ok: true; isCorrect: boolean }> {
  const me = await requireUser();
  const data = RecordAttemptSchema.parse(input);
  await assertCanAccessQuestion(me, data.questionId);
  const q = await db.question.findUnique({
    where: { id: data.questionId },
    select: { geminiAnswer: { select: { correctAnswer: true } } },
  });
  if (!q?.geminiAnswer) throw new Error("No cached answer for question");
  const isCorrect = data.chosen === q.geminiAnswer.correctAnswer;

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
      },
    });
  }
  return { ok: true, isCorrect };
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
  await db.comment.create({
    data: { userId: me.id, questionId: data.questionId, body: data.body },
  });
  revalidatePath(`/quiz`);
}

const EditCommentSchema = z.object({
  commentId: z.coerce.number(),
  body: z.string().min(1).max(2000),
});

export async function editCommentAction(formData: FormData) {
  const me = await requireUser();
  const data = EditCommentSchema.parse({
    commentId: formData.get("commentId"),
    body: formData.get("body"),
  });
  const comment = await db.comment.findUnique({
    where: { id: data.commentId },
    select: { userId: true },
  });
  if (!comment) return;
  if (comment.userId !== me.id && me.role !== "ADMIN") return;
  await db.comment.update({
    where: { id: data.commentId },
    data: { body: data.body, editedAt: new Date() },
  });
  revalidatePath("/quiz");
}

const DeleteCommentSchema = z.object({ commentId: z.coerce.number() });

export async function deleteCommentAction(formData: FormData) {
  const me = await requireUser();
  if (me.role !== "ADMIN") return;
  const { commentId } = DeleteCommentSchema.parse({ commentId: formData.get("commentId") });
  await db.comment.delete({ where: { id: commentId } });
  revalidatePath("/quiz");
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
  revalidatePath(`/quiz`);
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

const DeleteQuizSchema = z.object({ quizId: z.coerce.number() });

export async function deleteQuizAction(formData: FormData) {
  const me = await requireUser();
  const { quizId } = DeleteQuizSchema.parse({ quizId: formData.get("quizId") });
  // Verify ownership before deleting
  const quiz = await db.quiz.findFirst({ where: { id: quizId, userId: me.id }, select: { id: true } });
  if (!quiz) return; // silently ignore if not owned by user
  await db.quiz.delete({ where: { id: quizId } });
  revalidatePath("/study");
}
