import { db } from "@/lib/db";
import { hasUsableAnswerWhere } from "@/lib/plan";
import type { Quiz } from "@prisma/client";

export interface QuizProgress {
  answered: number;
  total: number;
  correct: number;
  isComplete: boolean;
  accuracyPct: number;
  lastActivityAt: Date | null;
}

/** Compute progress for a single quiz.  Counts only questions that have a
 *  geminiAnswer (same filter used by the quiz page). */
export async function getQuizProgress(quiz: Quiz): Promise<QuizProgress> {
  const useFixedSet = quiz.questionIds.length > 0;
  const [total, answeredRows] = await Promise.all([
    useFixedSet
      ? Promise.resolve(quiz.questionIds.length)
      : db.question.count({
          where: { chapterIds: { hasSome: quiz.chapterIds }, disabled: false, AND: [hasUsableAnswerWhere] },
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
  quizzes: Quiz[]
): Promise<Map<number, QuizProgress>> {
  if (quizzes.length === 0) return new Map();

  const allChapterIds = [...new Set(quizzes.flatMap((q) => q.chapterIds))];

  // Count eligible questions per chapter (a question may surface under multiple chapters via chapterIds[])
  const eligibleQuestions = await db.question.findMany({
    where: { chapterIds: { hasSome: allChapterIds }, disabled: false, AND: [hasUsableAnswerWhere] },
    select: { id: true, chapterIds: true },
  });
  // For each chapter, count how many eligible questions list it in their chapterIds
  const qPerChapter = new Map<number, number>();
  for (const cid of allChapterIds) {
    qPerChapter.set(
      cid,
      eligibleQuestions.filter((q) => q.chapterIds.includes(cid)).length,
    );
  }

  // All attempts for these quizzes
  const attempts = await db.attempt.findMany({
    where: { quizId: { in: quizzes.map((q) => q.id) } },
    select: { quizId: true, isCorrect: true, createdAt: true },
  });

  const result = new Map<number, QuizProgress>();
  for (const quiz of quizzes) {
    const total = quiz.questionIds.length > 0
      ? quiz.questionIds.length
      : quiz.chapterIds.reduce((sum, cid) => sum + (qPerChapter.get(cid) ?? 0), 0);
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
