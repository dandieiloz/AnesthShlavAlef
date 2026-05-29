export type PaceStatus = "notStarted" | "ahead" | "onTrack" | "behind";

export interface ScheduleInputs {
  examDate: Date;
  questionsPerWeek: number;
  /** Pool of questions available for practice (questions with a generated answer). */
  poolWithAnswer: number;
  /** Unique question IDs the user has attempted at least once. */
  uniqueAttempted: number;
  /** Attempt timestamps in the last 14 days (used for projected-finish pace). */
  recentAttempts14d: Date[];
  chaptersTotal: number;
  chaptersCovered: number;
  /** Optional override for testing; defaults to new Date(). */
  now?: Date;
}

export interface ScheduleResult {
  daysLeft: number;
  weeksLeft: number;
  questionsPerDay: number;
  remaining: number;
  /** Required daily rate to finish `remaining` by exam day. */
  requiredPerDay: number;
  /** Actual rolling daily average over the last 14 days. */
  recentAvgPerDay: number;
  /** Actual rolling weekly throughput (recentAvgPerDay * 7). */
  recentAvgPerWeek: number;
  paceDelta: number;
  paceStatus: PaceStatus;
  /** Days from today until projected completion at the current 14-day pace, or null if no recent activity. */
  projectedFinishDays: number | null;
  projectedFinishDate: Date | null;
  chaptersCovered: number;
  chaptersRemaining: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function computeSchedule(input: ScheduleInputs): ScheduleResult {
  const now = input.now ?? new Date();
  const today = startOfUtcDay(now);
  const exam = startOfUtcDay(input.examDate);

  const daysLeft = Math.max(0, Math.ceil((exam.getTime() - today.getTime()) / MS_PER_DAY));
  const weeksLeft = Math.round((daysLeft / 7) * 10) / 10;

  const qPerWeek = Math.max(1, input.questionsPerWeek);
  const questionsPerDay = Math.ceil(qPerWeek / 7);

  const remaining = Math.max(0, input.poolWithAnswer - input.uniqueAttempted);

  // Pace: compare actual recent throughput vs. required daily rate.
  const cutoff14 = today.getTime() - 14 * MS_PER_DAY;
  const recentCount = input.recentAttempts14d.filter((d) => d.getTime() >= cutoff14).length;
  const avgPerDay14 = recentCount / 14;
  const requiredPerDay = daysLeft > 0 ? remaining / daysLeft : remaining;
  const paceDelta = Math.round((avgPerDay14 - requiredPerDay) * 14); // questions ahead/behind over 2 weeks

  let paceStatus: PaceStatus;
  if (input.uniqueAttempted === 0 && recentCount === 0) {
    paceStatus = "notStarted";
  } else if (avgPerDay14 >= requiredPerDay * 1.05) {
    paceStatus = "ahead";
  } else if (avgPerDay14 >= requiredPerDay * 0.95) {
    paceStatus = "onTrack";
  } else {
    paceStatus = "behind";
  }

  let projectedFinishDays: number | null = null;
  let projectedFinishDate: Date | null = null;
  if (avgPerDay14 > 0 && remaining > 0) {
    projectedFinishDays = Math.ceil(remaining / avgPerDay14);
    projectedFinishDate = new Date(today.getTime() + projectedFinishDays * MS_PER_DAY);
  } else if (remaining === 0) {
    projectedFinishDays = 0;
    projectedFinishDate = today;
  }

  return {
    daysLeft,
    weeksLeft,
    questionsPerDay,
    remaining,
    requiredPerDay: Math.round(requiredPerDay * 10) / 10,
    recentAvgPerDay: Math.round(avgPerDay14 * 10) / 10,
    recentAvgPerWeek: Math.round(avgPerDay14 * 7 * 10) / 10,
    paceDelta,
    paceStatus,
    projectedFinishDays,
    projectedFinishDate,
    chaptersCovered: input.chaptersCovered,
    chaptersRemaining: Math.max(0, input.chaptersTotal - input.chaptersCovered),
  };
}
