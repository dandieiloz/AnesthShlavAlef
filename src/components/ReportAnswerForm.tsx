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
    <details className="group rounded-lg border-2 border-amber-400/60 bg-amber-50/70 dark:border-amber-500/40 dark:bg-amber-950/20 p-3 open:p-4">
      <summary className="flex cursor-pointer items-center gap-2 list-none text-sm font-semibold text-amber-900 dark:text-amber-200 hover:text-amber-700 dark:hover:text-amber-100 transition-colors">
        <Flag className="h-4 w-4 shrink-0" />
        <span>{labels.reportButton}</span>
        <span className="ms-auto text-xs font-normal text-amber-700/80 dark:text-amber-300/70 group-open:hidden">
          ▾
        </span>
      </summary>
      {labels.reportHint && (
        <p className="mt-2 text-xs leading-relaxed text-amber-900/80 dark:text-amber-200/80">
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
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <Flag className="h-3.5 w-3.5" />
          {labels.sendReport}
        </Button>
      </form>
    </details>
  );
}
