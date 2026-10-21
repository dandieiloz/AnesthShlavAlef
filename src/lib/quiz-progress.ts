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
  /** Correctness of each answer in the order it was given. */
  results: boolean[];
  /** Questions answered in this quiz (for comparing with other users). */
  answeredQuestionIds: number[];
}

function resultsInOrder(rows: { isCorrect: boolean; createdAt: Date }[]): boolean[] {
  return [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((r) => r.isCorrect);
}

/** Compute progress for a single quiz.  Counts only questions the user can
 *  actually be served (same plan/publish gate the quiz page uses). */
export async function getQuizProgress(user: PlanGatedUser, quiz: Quiz): Promise<QuizProgress> {
  const useFixedSet = quiz.questionIds.length > 0;
  const planGate = await questionAccessWhere(user);
  const [total, answeredRows] = await Promise.all([
    useFixedSet
      ? db.question.count({
          where: { id: { in: quiz.questionIds }, AND: [planGate, hasUsableAnswerWhere] },
        })
      : db.question.count({
          where: { chapterIds: { hasSome: quiz.chapterIds }, AND: [planGate, hasUsableAnswerWhere] },
        }),
    db.attempt.findMany({
      where: { quizId: quiz.id },
      select: { questionId: true, isCorrect: true, createdAt: true },
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
    results: resultsInOrder(answeredRows),
    answeredQuestionIds: answeredRows.map((a) => a.questionId),
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
  const allFixedIds = [...new Set(quizzes.flatMap((q) => q.questionIds))];
  // The three lookups are independent, so they share one round trip.
  const [eligibleQuestions, servableFixedRows, attempts] = await Promise.all([
    allChapterIds.length > 0
      ? db.question.findMany({
          where: { chapterIds: { hasSome: allChapterIds }, AND: [planGate, hasUsableAnswerWhere] },
          select: { id: true, chapterIds: true },
        })
      : Promise.resolve([] as { id: number; chapterIds: number[] }[]),
    allFixedIds.length > 0
      ? db.question.findMany({
          where: { id: { in: allFixedIds }, AND: [planGate, hasUsableAnswerWhere] },
          select: { id: true },
        })
      : Promise.resolve([] as { id: number }[]),
    db.attempt.findMany({
      where: { quizId: { in: quizzes.map((q) => q.id) } },
      select: { quizId: true, questionId: true, isCorrect: true, createdAt: true },
    }),
  ]);

  // Fixed-set quizzes pin specific question ids. Some of those may since have
  // become unservable (disabled, lost a usable answer, or fell out of plan), so
  // the total must count only the ids that still pass the gate — otherwise the
  // card shows a larger total than the quiz can ever deliver.
  const servableFixedIds = new Set(servableFixedRows.map((q) => q.id));

  const attemptsByQuiz = new Map<number, typeof attempts>();
  for (const a of attempts) {
    if (a.quizId === null) continue;
    const arr = attemptsByQuiz.get(a.quizId) ?? [];
    arr.push(a);
    attemptsByQuiz.set(a.quizId, arr);
  }

  const result = new Map<number, QuizProgress>();
  for (const quiz of quizzes) {
    let total: number;
    if (quiz.questionIds.length > 0) {
      total = quiz.questionIds.filter((id) => servableFixedIds.has(id)).length;
    } else {
      // Distinct count: how many eligible questions intersect this quiz's chapters.
      const quizChapterSet = new Set(quiz.chapterIds);
      total = eligibleQuestions.filter((q) =>
        q.chapterIds.some((cid) => quizChapterSet.has(cid)),
      ).length;
    }
    const quizAttempts = attemptsByQuiz.get(quiz.id) ?? [];
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
      results: resultsInOrder(quizAttempts),
      answeredQuestionIds: quizAttempts.map((a) => a.questionId),
    });
  }
  return result;
}
