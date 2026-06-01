import { Flag } from "lucide-react";
import { reportAnswerAction } from "@/app/(user)/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  questionId: number;
  labels: {
    reportButton: string;
    reportHint?: string;
    reportFieldLabel?: string;
    reportPlaceholder: string;
    reportMinHint?: string;
    sendReport: string;
  };
};

export function ReportAnswerForm({ questionId, labels }: Props) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer select-none items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-amber-700 transition-colors hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 list-none">
        <Flag className="h-3.5 w-3.5 shrink-0" />
        <span>{labels.reportButton}</span>
      </summary>
      <div className="mt-3 w-full max-w-2xl rounded-lg border-2 border-amber-400/60 bg-amber-50/70 p-3 dark:border-amber-500/40 dark:bg-amber-950/20 open:p-4">
        {labels.reportHint && (
          <p className="text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
            {labels.reportHint}
          </p>
        )}
        <form action={reportAnswerAction} className="mt-3 space-y-2">
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
          <Button
            variant="default"
            size="sm"
            type="submit"
            className="gap-2 bg-amber-600 text-white hover:bg-amber-700"
          >
            <Flag className="h-3.5 w-3.5" />
            {labels.sendReport}
          </Button>
        </form>
      </div>
    </details>
  );
}
