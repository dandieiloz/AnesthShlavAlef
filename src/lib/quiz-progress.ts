import { db } from "@/lib/db";
import { hasUsableAnswerWhere, questionAccessWhere, type PlanGatedUser } from "@/lib/plan";
import type { Quiz } from "@prisma/client";

export interface QuizProgress {
  answered: number;
  total: number;
  correct: number;
  isComplete: boolean;
  accuracyPct: number;
  lastActivityAt: Date | null;
}

/** Compute progress for a single quiz.  Counts only questions the user can
 *  actually be served (same plan/publish gate the quiz page uses). */
export async function getQuizProgress(user: PlanGatedUser, quiz: Quiz): Promise<QuizProgress> {
  const useFixedSet = quiz.questionIds.length > 0;
  const planGate = await questionAccessWhere(user);
  const [total, answeredRows] = await Promise.all([
    useFixedSet
      ? Promise.resolve(quiz.questionIds.length)
      : db.question.count({
          where: { chapterIds: { hasSome: quiz.chapterIds }, AND: [planGate, hasUsableAnswerWhere] },
        }),
    db.attempt.findMany({
      where: { quizId: quiz.id },
      select: { isCorrect: true, createdAt: true },
    }),
  ]);
  const answered = answeredRows.length;
  const correctCount = answeredRows.filter((a) => a.isCorrect).length;
  const lastActivityAt =
    answeredRows.length > 0
      ? new Date(Math.max(...answeredRows.map((a) => a.createdAt.getTime())))
      : null;
  return {
    answered,
    total,
    correct: correctCount,
    isComplete: total > 0 && answered >= total,
    accuracyPct: answered === 0 ? 0 : Math.round((correctCount / answered) * 100),
    lastActivityAt,
  };
}

/** Batch-fetch progress for many quizzes with 3 queries total (no N+1). */
export async function getQuizProgressMany(
  user: PlanGatedUser,
  quizzes: Quiz[]
): Promise<Map<number, QuizProgress>> {
  if (quizzes.length === 0) return new Map();

  const allChapterIds = [...new Set(quizzes.flatMap((q) => q.chapterIds))];
  const planGate = await questionAccessWhere(user);

  // Fetch every question the user could actually be served across all of these
  // quizzes' chapters (same plan/publish gate the quiz page uses). We keep the
  // per-question chapterIds so each quiz's total is a DISTINCT count — a
  // question that lists several of the quiz's chapters must only count once.
  const eligibleQuestions = await db.question.findMany({
    where: { chapterIds: { hasSome: allChapterIds }, AND: [planGate, hasUsableAnswerWhere] },
    select: { id: true, chapterIds: true },
  });

  // All attempts for these quizzes
  const attempts = await db.attempt.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) } },
    select: { quizId: true, isCorrect: true, createdAt: true },
  });

  const result = new Map<number, QuizProgress>();
  for (const quiz of quizzes) {
    let total: number;
    if (quiz.questionIds.length > 0) {
      total = quiz.questionIds.length;
    } else {
      // Distinct count: how many eligible questions intersect this quiz's chapters.
      const quizChapterSet = new Set(quiz.chapterIds);
      total = eligibleQuestions.filter((q) =>
        q.chapterIds.some((cid) => quizChapterSet.has(cid)),
      ).length;
    }
    const quizAttempts = attempts.filter((a) => a.quizId === quiz.id);
    const answered = quizAttempts.length;
    const correct = quizAttempts.filter((a) => a.isCorrect).length;
    const lastActivityAt =
      quizAttempts.length > 0
        ? new Date(Math.max(...quizAttempts.map((a) => a.createdAt.getTime())))
        : null;
    result.set(quiz.id, {
      answered,
      total,
      correct,
      isComplete: total > 0 && answered >= total,
      accuracyPct: answered === 0 ? 0 : Math.round((correct / answered) * 100),
      lastActivityAt,
    });
  }
  return result;
}
