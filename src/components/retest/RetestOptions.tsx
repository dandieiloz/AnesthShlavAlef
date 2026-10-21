"use client";
import { useState, useTransition, type ReactNode } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { recordStandaloneAttemptAction } from "@/app/(user)/review-quiz-actions";
import { useHideAnswers } from "./hide-answers";

type Key = "A" | "B" | "C" | "D";

export interface RetestLabels {
  pickAnswer: string;
  tryAgain: string;
  correct: string;
  wrong: string;
}

/**
 * Answer options for a question outside a quiz. Normally the correct answer is
 * marked. When "hide answers" is on, the options start neutral and the
 * explanation (`children`) stays hidden until the user picks one; that pick is
 * recorded as an attempt so the "Got wrong" list stays current.
 */
export function RetestOptions({
  questionId,
  options,
  correctKeys,
  labels,
  dir,
  children,
}: {
  questionId: number;
  options: { key: Key; letter: string; text: string }[];
  correctKeys: Key[];
  labels: RetestLabels;
  dir: "rtl" | "ltr";
  children?: ReactNode;
}) {
  const hide = useHideAnswers();
  const [picked, setPicked] = useState<Key | null>(null);
  const [, startTransition] = useTransition();

  const testing = hide && picked === null;
  const revealed = !testing;

  function pick(k: Key) {
    if (!testing) return;
    setPicked(k);
    startTransition(async () => {
      try {
        await recordStandaloneAttemptAction({ questionId, chosen: k });
      } catch {
        /* recording is best-effort; the reveal still works */
      }
    });
  }

  const pickedCorrect = picked !== null && correctKeys.includes(picked);

  return (
    <div className="space-y-3">
      {testing && <p className="text-xs text-muted-foreground">{labels.pickAnswer}</p>}
      <div className="space-y-1.5" dir={dir}>
        {options.map((o) => {
          const isCorrect = revealed && correctKeys.includes(o.key);
          const isWrongPick = revealed && picked === o.key && !correctKeys.includes(o.key);
          const rowClass = cn(
            "flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-start text-sm transition-colors",
            isCorrect
              ? "border-success/50 bg-success/10"
              : isWrongPick
                ? "border-destructive/50 bg-destructive/10"
                : testing
                  ? "cursor-pointer border-border bg-background hover:border-primary/40 hover:bg-primary/5"
                  : "border-border bg-background text-muted-foreground",
          );
          const letterClass = cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
            isCorrect ? "bg-success text-white" : isWrongPick ? "bg-destructive text-white" : "bg-muted text-muted-foreground",
          );
          const content = (
            <>
              <span className={letterClass}>{o.letter}</span>
              <span className="flex-1 leading-snug">{o.text}</span>
              {isCorrect && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
              {isWrongPick && <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
            </>
          );
          return testing ? (
            <button key={o.key} type="button" onClick={() => pick(o.key)} className={rowClass}>
              {content}
            </button>
          ) : (
            <div key={o.key} className={rowClass}>
              {content}
            </div>
          );
        })}
      </div>

      {hide && picked !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("text-sm font-semibold", pickedCorrect ? "text-success" : "text-destructive")}>
            {pickedCorrect ? labels.correct : labels.wrong}
          </span>
          <button
            type="button"
            onClick={() => setPicked(null)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {labels.tryAgain}
          </button>
        </div>
      )}

      {revealed && children}
    </div>
  );
}
