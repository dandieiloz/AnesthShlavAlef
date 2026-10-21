import { db } from "@/lib/db";
import { computeSchedule, type ScheduleResult } from "@/lib/schedule";
import { questionAccessWhere, hasUsableAnswerWhere, type PlanGatedUser } from "@/lib/plan";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ExamPlanData {
  examDate: Date | null;
  questionsPerWeek: number | null;
  /** Questions the user can practice (published, with a usable answer). */
  poolWithAnswer: number;
  /** Distinct questions the user has attempted at least once. */
  uniqueAttempted: number;
  chaptersTotal: number;
  chaptersCovered: number;
  /** Null when the user has not set both an exam date and a weekly target. */
  result: ScheduleResult | null;
}

/**
 * Everything the exam-plan views need: the user's saved plan, pool size,
 * coverage, and the computed pace. Shared by the Home "today" card and the
 * Progress page so both show the same numbers.
 */
export async function getExamPlanData(user: PlanGatedUser & { id: string }): Promise<ExamPlanData> {
  const cutoff14 = new Date(Date.now() - 14 * MS_PER_DAY);
  const planGate = await questionAccessWhere(user);

  const [dbUser, poolWithAnswer, attempted, recent14, chaptersTotal, coveredRows] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { examDate: true, questionsPerWeek: true },
    }),
    db.question.count({ where: { AND: [planGate, hasUsableAnswerWhere] } }),
    db.attempt.findMany({
      where: { userId: user.id },
      select: { questionId: true },
      distinct: ["questionId"],
    }),
    db.attempt.findMany({
      where: { userId: user.id, createdAt: { gte: cutoff14 } },
      select: { createdAt: true },
    }),
    db.chapter.count(),
    // Distinct chapters among attempted questions, computed in the database.
    db.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(DISTINCT q."chapterId") AS n
      FROM "Attempt" a
      JOIN "Question" q ON q."id" = a."questionId"
      WHERE a."userId" = ${user.id}
    `,
  ]);

  const uniqueAttempted = attempted.length;

  const chaptersCovered = Number(coveredRows[0]?.n ?? 0);

  const examDate = dbUser?.examDate ?? null;
  const questionsPerWeek = dbUser?.questionsPerWeek ?? null;

  const result =
    examDate && questionsPerWeek
      ? computeSchedule({
          examDate,
          questionsPerWeek,
          poolWithAnswer,
          uniqueAttempted,
          recentAttempts14d: recent14.map((r) => r.createdAt),
          chaptersTotal,
          chaptersCovered,
        })
      : null;

  return {
    examDate,
    questionsPerWeek,
    poolWithAnswer,
    uniqueAttempted,
    chaptersTotal,
    chaptersCovered,
    result,
  };
}
