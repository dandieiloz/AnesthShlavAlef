import { db } from "@/lib/db";
import { computeLevel, type LevelComputation } from "@/lib/progress-level";

const TOTAL_TTL_MS = 5 * 60 * 1000;
let totalCache: { value: number; expiresAt: number } | null = null;

async function getTotalQuestionCount(): Promise<number> {
  const now = Date.now();
  if (totalCache && totalCache.expiresAt > now) return totalCache.value;
  const value = await db.question.count({
    where: { disabled: false, geminiAnswer: { isNot: null } },
  });
  totalCache = { value, expiresAt: now + TOTAL_TTL_MS };
  return value;
}

/**
 * Server-side: returns the user's progress state, or null when no userId is given.
 * `solved` = distinct questionIds the user has attempted (any choice, correct or not).
 */
export async function getUserProgress(userId: string | undefined | null): Promise<LevelComputation | null> {
  if (!userId) return null;
  const [distinct, total] = await Promise.all([
    db.attempt.findMany({
      where: { userId },
      distinct: ["questionId"],
      select: { questionId: true },
    }),
    getTotalQuestionCount(),
  ]);
  return computeLevel(distinct.length, total);
}
