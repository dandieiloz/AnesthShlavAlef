import { db } from "@/lib/db";

export interface DayActivity {
  date: string; // "YYYY-MM-DD" in UTC
  count: number;
  correct: number;
}

export interface AccuracyPoint {
  date: string; // end of the window "YYYY-MM-DD" in UTC
  accuracyPct: number;
  count: number; // questions answered in this bucket
}

/** Return per-day activity for the last `days` days (inclusive of today). */
export async function getActivityHeatmap(
  userId: string,
  days = 120
): Promise<DayActivity[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days + 1);
  since.setUTCHours(0, 0, 0, 0);

  const attempts = await db.attempt.findMany({
    where: { userId, createdAt: { gte: since } },
    select: { createdAt: true, isCorrect: true },
  });

  const byDay = new Map<string, { count: number; correct: number }>();
  for (const a of attempts) {
    const key = a.createdAt.toISOString().slice(0, 10);
    const row = byDay.get(key) ?? { count: 0, correct: 0 };
    row.count++;
    if (a.isCorrect) row.correct++;
    byDay.set(key, row);
  }

  // Build a full calendar grid (all days in range, even empty ones)
  const result: DayActivity[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setUTCDate(since.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = byDay.get(key) ?? { count: 0, correct: 0 };
    result.push({ date: key, ...row });
  }
  return result;
}

/** Compute current consecutive-day streak (days with ≥1 attempt up to and
 *  including today).  Fetches from the heatmap if already computed. */
export function getCurrentStreak(heatmap: DayActivity[]): number {
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  // Walk backwards from today
  for (let i = heatmap.length - 1; i >= 0; i--) {
    const d = heatmap[i];
    if (d.date > today) continue; // shouldn't happen but guard
    if (d.count === 0) break;
    streak++;
  }
  return streak;
}

/** Rolling 7-day accuracy series for the last `windowDays` days.
 *  Returns one point per day where the 7-day window ending on that day had
 *  at least one answered question. */
export function getAccuracyOverTime(
  heatmap: DayActivity[],
  windowSize = 7
): AccuracyPoint[] {
  const result: AccuracyPoint[] = [];
  for (let i = windowSize - 1; i < heatmap.length; i++) {
    const window = heatmap.slice(i - windowSize + 1, i + 1);
    const count = window.reduce((s, d) => s + d.count, 0);
    if (count === 0) continue;
    const correct = window.reduce((s, d) => s + d.correct, 0);
    result.push({
      date: heatmap[i].date,
      accuracyPct: Math.round((correct / count) * 100),
      count,
    });
  }
  return result;
}
