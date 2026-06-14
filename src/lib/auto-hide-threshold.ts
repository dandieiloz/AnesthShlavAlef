import { db } from "@/lib/db";

const MIN_ATTEMPTS_KEY = "autoHideMinAttempts";
const MAX_CORRECT_PCT_KEY = "autoHideMaxCorrectPercent";

/** Default min attempts of 0 means the rule is disabled. */
export const DEFAULT_AUTO_HIDE_MIN_ATTEMPTS = 0;
/** Default max correct ratio (0-1) used when none stored. */
export const DEFAULT_AUTO_HIDE_MAX_CORRECT_PERCENT = 0.4;

export type AutoHideConfig = {
  /** Minimum number of attempts a question needs before the rule applies. 0 = disabled. */
  minAttempts: number;
  /** Correct-answer ratio (0-1) at or below which a question is auto-hidden. */
  maxCorrectPercent: number;
};

function clampMinAttempts(n: number): number {
  if (!Number.isFinite(n) || n < 0) return DEFAULT_AUTO_HIDE_MIN_ATTEMPTS;
  return Math.floor(n);
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_AUTO_HIDE_MAX_CORRECT_PERCENT;
  return Math.max(0, Math.min(1, n));
}

export async function getAutoHideConfig(): Promise<AutoHideConfig> {
  const rows = await db.siteContent.findMany({
    where: { key: { in: [MIN_ATTEMPTS_KEY, MAX_CORRECT_PCT_KEY] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const minRaw = map.get(MIN_ATTEMPTS_KEY);
  const pctRaw = map.get(MAX_CORRECT_PCT_KEY);
  return {
    minAttempts: minRaw === undefined ? DEFAULT_AUTO_HIDE_MIN_ATTEMPTS : clampMinAttempts(Number(minRaw)),
    maxCorrectPercent:
      pctRaw === undefined ? DEFAULT_AUTO_HIDE_MAX_CORRECT_PERCENT : clamp01(Number(pctRaw)),
  };
}

export async function setAutoHideConfig(
  minAttempts: number,
  maxCorrectPercent: number,
): Promise<AutoHideConfig> {
  const min = clampMinAttempts(Number(minAttempts));
  const pct = clamp01(Number(maxCorrectPercent));
  await db.$transaction([
    db.siteContent.upsert({
      where: { key: MIN_ATTEMPTS_KEY },
      create: { key: MIN_ATTEMPTS_KEY, value: String(min) },
      update: { value: String(min) },
    }),
    db.siteContent.upsert({
      where: { key: MAX_CORRECT_PCT_KEY },
      create: { key: MAX_CORRECT_PCT_KEY, value: String(pct) },
      update: { value: String(pct) },
    }),
  ]);
  return { minAttempts: min, maxCorrectPercent: pct };
}

/**
 * Returns the ids of questions that fail the auto-hide rule: at least
 * `minAttempts` attempts AND a correct-answer ratio at or below
 * `maxCorrectPercent`. Returns an empty array when the rule is disabled
 * (minAttempts <= 0). Admin-approval is intentionally NOT considered here;
 * callers AND this with an `adminApproved` exemption.
 */
export async function getAutoHiddenQuestionIds(config?: AutoHideConfig): Promise<number[]> {
  const { minAttempts, maxCorrectPercent } = config ?? (await getAutoHideConfig());
  if (minAttempts <= 0) return [];
  const rows = await db.$queryRaw<{ questionId: number }[]>`
    SELECT "questionId"
    FROM "Attempt"
    GROUP BY "questionId"
    HAVING COUNT(*) >= ${minAttempts}
      AND (SUM(CASE WHEN "isCorrect" THEN 1 ELSE 0 END)::float / COUNT(*)) <= ${maxCorrectPercent}
  `;
  return rows.map((r) => r.questionId);
}
