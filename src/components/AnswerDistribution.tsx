"use client";

import { BarChart3, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Choice = "A" | "B" | "C" | "D";

export type AnswerDistributionData = {
  A: number;
  B: number;
  C: number;
  D: number;
};

const HEBREW_LETTERS: Record<Choice, string> = { A: "א", B: "ב", C: "ג", D: "ד" };
const ORDER: Choice[] = ["A", "B", "C", "D"];

const UI = {
  he: {
    title: "התפלגות התשובות",
    total: (n: number) => `סה״כ ${n} ניסיונות`,
    yourPick: "הבחירה שלך",
  },
  en: {
    title: "Answer distribution",
    total: (n: number) => `${n} attempts total`,
    yourPick: "Your pick",
  },
};

type Props = {
  distribution: AnswerDistributionData;
  options: { key: Choice; text: string }[];
  correctAnswer: Choice;
  acceptedAnswers?: Choice[];
  userChoice?: Choice;
  locale?: "he" | "en";
};

export function AnswerDistribution({
  distribution,
  options,
  correctAnswer,
  acceptedAnswers = [],
  userChoice,
  locale = "he",
}: Props) {
  const ui = UI[locale] ?? UI.he;
  const letters = locale === "he" ? HEBREW_LETTERS : { A: "A", B: "B", C: "C", D: "D" };

  const total = ORDER.reduce((sum, k) => sum + (distribution[k] || 0), 0);
  if (total === 0) return null;

  const textByKey = new Map(options.map((o) => [o.key, o.text]));

  return (
    <div className="rounded-xl border border-sky-400/30 bg-sky-400/[0.04] dark:bg-sky-400/[0.06]" dir="rtl">
      <div className="flex items-center gap-2 rounded-t-xl border-b border-sky-400/25 bg-sky-400/[0.10] px-4 py-2.5">
        <BarChart3 className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">
          {ui.title}
        </span>
        <span className="ms-auto text-[11px] font-medium text-muted-foreground">
          {ui.total(total)}
        </span>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        {ORDER.map((k) => {
          const count = distribution[k] || 0;
          const pct = Math.round((count / total) * 100);
          const isCorrect = correctAnswer === k || acceptedAnswers.includes(k);
          const isUserPick = userChoice === k;
          return (
            <div
              key={k}
              className={cn(
                "space-y-1 rounded-lg",
                isUserPick && "-mx-1.5 bg-primary/[0.06] px-1.5 py-1 ring-1 ring-primary/30",
              )}
            >
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                    isCorrect
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {letters[k]}
                </span>
                <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-foreground/70">
                  {pct}%
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70">
                  ({count})
                </span>
                <span
                  dir="rtl"
                  className="min-w-0 flex-1 truncate text-right text-foreground/80 [unicode-bidi:plaintext]"
                  title={textByKey.get(k) ?? ""}
                >
                  {textByKey.get(k) ?? ""}
                </span>
                {isUserPick && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {ui.yourPick}
                  </span>
                )}
                {isCorrect && (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    isCorrect
                      ? "bg-emerald-500/80 dark:bg-emerald-400/70"
                      : isUserPick
                        ? "bg-primary/60"
                        : "bg-foreground/20",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
