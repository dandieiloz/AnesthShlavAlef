import type { Locale } from "@/lib/locale";

/** Short "DD.MM" label in Israel time, used to tell same-named quizzes apart. */
export function shortDateLabel(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).formatToParts(date);
  const day = parts.find((p) => p.type === "day")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${day}.${month}`;
}

export function withDate(base: string, date: Date = new Date()): string {
  return `${base} · ${shortDateLabel(date)}`;
}

export type ReviewSource = "wrong" | "saved";

export function reviewQuizBaseName(source: ReviewSource, locale: Locale): string {
  if (locale === "he") return source === "wrong" ? "טעויות" : "שמורות";
  return source === "wrong" ? "Mistakes" : "Saved";
}
