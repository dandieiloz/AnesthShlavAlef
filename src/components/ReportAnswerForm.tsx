"use client";

import { useActionState, useEffect, useRef } from "react";
import { Flag, CheckCircle2, AlertCircle } from "lucide-react";
import { reportAnswerAction } from "@/app/(user)/actions";
import { Textarea } from "@/components/ui/textarea";
import { SubmitButton } from "@/components/SubmitButton";

type Props = {
  questionId: number;
  hasPendingReport?: boolean;
  labels: {
    reportButton: string;
    reportHint?: string;
    reportFieldLabel?: string;
    reportPlaceholder: string;
    reportMinHint?: string;
    sendReport: string;
    reportThanks: string;
    pendingReport: string;
  };
};

type State = { sent: boolean };

export function ReportAnswerForm({ questionId, hasPendingReport, labels }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [state, formAction] = useActionState<State, FormData>(
    async (_prev, formData) => {
      await reportAnswerAction(formData);
      return { sent: true };
    },
    { sent: false },
  );

  useEffect(() => {
    if (state.sent) {
      formRef.current?.reset();
      if (detailsRef.current) detailsRef.current.open = false;
    }
  }, [state.sent]);

  const showPendingBadge = hasPendingReport || state.sent;

  return (
    <details ref={detailsRef} className="group">
      <summary className="flex cursor-pointer select-none items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 list-none">
        <Flag className="h-3.5 w-3.5 shrink-0" />
        <span>{labels.reportButton}</span>
        {showPendingBadge && (
          <span
            className="ms-1 inline-flex items-center gap-1 rounded-full border border-amber-400/60 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-500/40 dark:bg-amber-900/40 dark:text-amber-200"
            title={labels.pendingReport}
          >
            <AlertCircle className="h-3 w-3 shrink-0" />
            {labels.pendingReport}
          </span>
        )}
      </summary>
      <div className="mt-3 w-full max-w-2xl rounded-lg border-2 border-amber-400/60 bg-amber-50/70 p-3 dark:border-amber-500/40 dark:bg-amber-950/20 open:p-4">
        {labels.reportHint && (
          <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
            {labels.reportHint}
          </p>
        )}
        {state.sent && (
          <div
            role="status"
            aria-live="polite"
            className="mt-3 flex items-center gap-2 rounded-md border border-emerald-400/60 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-200"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{labels.reportThanks}</span>
          </div>
        )}
        <form ref={formRef} action={formAction} className="mt-3 space-y-2">
          <input type="hidden" name="questionId" value={questionId} />
          {labels.reportFieldLabel && (
            <label
              htmlFor={`report-explanation-${questionId}`}
              className="block text-xs font-medium text-amber-900 dark:text-amber-200"
            >
              {labels.reportFieldLabel}
            </label>
          )}
          <Textarea
            id={`report-explanation-${questionId}`}
            name="explanation"
            required
            minLength={10}
            rows={3}
            placeholder={labels.reportPlaceholder}
            className="text-sm bg-background"
          />
          {labels.reportMinHint && (
            <p className="text-[11px] text-amber-800/70 dark:text-amber-300/60">
              {labels.reportMinHint}
            </p>
          )}
          <SubmitButton
            variant="default"
            size="sm"
            className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
          >
            <Flag className="h-3.5 w-3.5" />
            {labels.sendReport}
          </SubmitButton>
        </form>
      </div>
    </details>
  );
}
