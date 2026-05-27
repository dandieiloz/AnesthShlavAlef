/** Single source of truth for the learning-usefulness-index colour scale. */
export type UsefulnessTone = "unrated" | "low" | "medium" | "high" | "very-high";

export function usefulnessTone(n: number | null): UsefulnessTone {
  if (n === null) return "unrated";
  if (n <= 10) return "very-high";
  if (n <= 20) return "high";
  if (n <= 30) return "medium";
  return "low";
}

export const TONE_ROW_CLASS: Record<UsefulnessTone, string> = {
  unrated:   "row-unrated",
  low:       "row-low",
  medium:    "row-medium",
  high:      "row-high",
  "very-high": "row-very-high",
};

export const TONE_BADGE_CLASS: Record<UsefulnessTone, string> = {
  unrated:     "bg-muted text-muted-foreground",
  low:         "bg-sky-200 text-sky-900 dark:bg-sky-800 dark:text-sky-100",
  medium:      "bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100",
  high:        "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100",
  "very-high": "bg-rose-200 text-rose-900 dark:bg-rose-800 dark:text-rose-100",
};

export const TONE_DOT_CLASS: Record<UsefulnessTone, string> = {
  unrated:   "bg-muted-foreground/40",
  low:       "bg-sky-500",
  medium:    "bg-emerald-500",
  high:      "bg-amber-500",
  "very-high": "bg-rose-500",
};

export const TONE_LABEL: Record<UsefulnessTone, string> = {
  unrated:   "—",
  low:       "נמוך",
  medium:    "בינוני",
  high:      "גבוה",
  "very-high": "גבוה מאוד",
};

export const TONE_LABEL_EN: Record<UsefulnessTone, string> = {
  unrated:   "—",
  low:       "Low",
  medium:    "Medium",
  high:      "High",
  "very-high": "Very high",
};

export function toneLabel(tone: UsefulnessTone, locale: "he" | "en"): string {
  return locale === "en" ? TONE_LABEL_EN[tone] : TONE_LABEL[tone];
}
