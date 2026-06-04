/**
 * Tolerance for clock skew between server-issued timestamps and the client's
 * `Date.now()`. Anything that looks like it happened up to this many seconds
 * "in the future" is treated as having just happened — this is what prevents
 * UI strings like "in 5 seconds" / "בעוד 5 שניות" for records that were just
 * created on the server.
 */
const FUTURE_SKEW_TOLERANCE_SEC = 60;

type RelLocale = "he" | "en" | string;

function resolveBcp47(locale: RelLocale): string {
  if (locale === "he") return "he-IL";
  if (locale === "en") return "en-US";
  return locale;
}

const formatterCache = new Map<string, Intl.RelativeTimeFormat>();
function getRelativeFormatter(locale: RelLocale): Intl.RelativeTimeFormat {
  const tag = resolveBcp47(locale);
  let f = formatterCache.get(tag);
  if (!f) {
    f = new Intl.RelativeTimeFormat(tag, { numeric: "auto" });
    formatterCache.set(tag, f);
  }
  return f;
}

/**
 * Format an instant relative to `now`, tolerant of small clock skew.
 *
 * The platform's relative timestamps were drifting into the future when a
 * user's browser clock lagged behind the server clock — a freshly inserted
 * row would render as "in a few seconds". This helper clamps any apparent
 * future delta within `FUTURE_SKEW_TOLERANCE_SEC` to "now".
 */
export function formatRelativeTime(
  date: Date | string | number,
  now: Date | number,
  locale: RelLocale = "he",
): string {
  const target = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const reference = typeof now === "number" ? now : now.getTime();
  if (!Number.isFinite(target)) return "";

  let diffSec = Math.round((target - reference) / 1000);
  // Clamp small clock-skew futures so we never show "in N seconds" for things
  // that just happened on the server.
  if (diffSec > 0 && diffSec <= FUTURE_SKEW_TOLERANCE_SEC) diffSec = 0;

  const fmt = getRelativeFormatter(locale);
  const abs = Math.abs(diffSec);
  if (abs < 60) return fmt.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return fmt.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return fmt.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return fmt.format(diffDay, "day");
  const diffMo = Math.round(diffDay / 30);
  if (Math.abs(diffMo) < 12) return fmt.format(diffMo, "month");
  return fmt.format(Math.round(diffMo / 12), "year");
}

/**
 * Day-granularity comparison ("today" / "yesterday" / explicit date), with
 * the same future-skew clamping as `formatRelativeTime`.
 */
export function formatRelativeDay(
  date: Date | string | number,
  now: Date | number,
  locale: RelLocale,
  labels: { today: string; yesterday: string },
): string {
  const target = date instanceof Date ? date.getTime() : new Date(date).getTime();
  const reference = typeof now === "number" ? now : now.getTime();
  if (!Number.isFinite(target)) return "";

  const deltaMs = reference - target;
  // Treat near-future timestamps as "today" to absorb clock skew.
  const skewMs = FUTURE_SKEW_TOLERANCE_SEC * 1000;
  const diffDays = Math.floor(Math.max(deltaMs, -skewMs) / 86_400_000);

  if (diffDays <= 0) return labels.today;
  if (diffDays === 1) return labels.yesterday;
  return new Date(target).toLocaleDateString(resolveBcp47(locale));
}
