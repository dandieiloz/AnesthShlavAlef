"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/locale";

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

function format(date: Date, locale: Locale, justNow: string): string {
  const rtf = new Intl.RelativeTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    numeric: "auto",
  });
  let duration = (date.getTime() - Date.now()) / 1000;
  if (Math.abs(duration) < 45) return justNow;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return justNow;
}

/**
 * Renders a relative timestamp (e.g. "לפני 5 דקות"). Computed on the client to
 * avoid SSR/CSR hydration drift; renders the absolute date on the server first.
 */
export function RelativeTime({
  date,
  locale,
  justNow,
  className,
}: {
  date: string | Date;
  locale: Locale;
  justNow: string;
  className?: string;
}) {
  const d = typeof date === "string" ? new Date(date) : date;
  const absolute = d.toLocaleDateString(locale === "he" ? "he-IL" : "en-US");
  const [label, setLabel] = useState(absolute);

  useEffect(() => {
    setLabel(format(d, locale, justNow));
    const id = setInterval(() => setLabel(format(d, locale, justNow)), 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, locale, justNow]);

  return (
    <time dateTime={d.toISOString()} title={d.toLocaleString(locale === "he" ? "he-IL" : "en-US")} className={className}>
      {label}
    </time>
  );
}
