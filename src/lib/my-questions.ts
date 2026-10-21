import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { questionAccessWhere, type PlanGatedUser } from "@/lib/plan";
import type { Locale } from "@/lib/locale";

export interface MyQuestionCounts {
  /** Distinct questions the user has attempted. */
  seen: number;
  /** Distinct questions whose latest attempt was wrong. */
  wrong: number;
  /** Bookmarked questions plus questions with highlights (deduplicated). */
  saved: number;
}

export interface LatestAttemptInfo {
  isCorrect: boolean;
  createdAt: Date;
}

/**
 * The user's latest attempt per question (plan-gated), keyed by question id.
 * Optionally narrowed with an extra question filter (e.g. chapters).
 */
export async function getLatestAttemptByQuestion(
  user: PlanGatedUser,
  questionWhere?: Prisma.QuestionWhereInput,
): Promise<Map<number, LatestAttemptInfo>> {
  const planGate = (await questionAccessWhere(user)) as Prisma.QuestionWhereInput;
  const rows = await db.attempt.findMany({
    where: {
      userId: user.id,
      question: questionWhere ? { AND: [planGate, questionWhere] } : planGate,
    },
    select: { questionId: true, isCorrect: true, createdAt: true },
    // Newest first, so the first row per question is the latest attempt.
    orderBy: { createdAt: "desc" },
  });
  const latest = new Map<number, LatestAttemptInfo>();
  for (const a of rows) {
    if (!latest.has(a.questionId)) latest.set(a.questionId, { isCorrect: a.isCorrect, createdAt: a.createdAt });
  }
  return latest;
}

/** Question ids whose latest attempt was wrong. */
export async function getWrongQuestionIds(
  user: PlanGatedUser,
  questionWhere?: Prisma.QuestionWhereInput,
): Promise<number[]> {
  const latest = await getLatestAttemptByQuestion(user, questionWhere);
  return [...latest.entries()].filter(([, a]) => !a.isCorrect).map(([id]) => id);
}

/** Bookmarked question ids plus ids of questions with highlights in `contentLocale`. */
export async function getSavedQuestionIds(user: PlanGatedUser, contentLocale: Locale): Promise<number[]> {
  const planGate = (await questionAccessWhere(user)) as Prisma.QuestionWhereInput;
  const [bookmarks, highlights] = await Promise.all([
    db.bookmark.findMany({
      where: { userId: user.id, question: planGate },
      select: { questionId: true },
    }),
    db.sentenceHighlight.findMany({
      where: { userId: user.id, locale: contentLocale, question: planGate },
      select: { questionId: true },
      distinct: ["questionId"],
    }),
  ]);
  return [...new Set([...bookmarks.map((b) => b.questionId), ...highlights.map((h) => h.questionId)])];
}

/**
 * Counts behind the three "My questions" tabs. Uses the same plan gate as the
 * lists themselves so the badge numbers match what the user sees.
 */
export async function getMyQuestionCounts(user: PlanGatedUser, contentLocale: Locale): Promise<MyQuestionCounts> {
  const [latest, saved] = await Promise.all([
    getLatestAttemptByQuestion(user),
    getSavedQuestionIds(user, contentLocale),
  ]);
  let wrong = 0;
  for (const a of latest.values()) if (!a.isCorrect) wrong++;
  return { seen: latest.size, wrong, saved: saved.length };
}
