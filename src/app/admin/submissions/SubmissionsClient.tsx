"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { analyzeSubmissionAction, importSubmissionAction, rejectSubmissionAction } from "./actions";
import type { StandardizedQuestion } from "@/lib/submission-analysis";
import type { SubmissionStatus } from "@prisma/client";

export type SubmissionRow = {
  id: string;
  institute: string;
  year: number | null;
  chapterHint: string | null;
  doctorName: string | null;
  submitterLabel: string;
  content: string;
  fileName: string | null;
  status: SubmissionStatus;
  analysis: StandardizedQuestion[] | null;
  importedCount: number;
  createdAt: string;
};

const OPTION_LABELS = ["א", "ב", "ג", "ד"] as const;
const ANSWER_LABEL: Record<string, string> = { A: "א", B: "ב", C: "ג", D: "ד" };

const STATUS_BADGE: Record<SubmissionStatus, { label: string; cls: string }> = {
  NEW: { label: "חדשה", cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300" },
  ANALYZED: { label: "נותחה", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  IMPORTED: { label: "יובאה", cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  REJECTED: { label: "נדחתה", cls: "bg-muted text-muted-foreground" },
};

export function SubmissionCard({ submission }: { submission: SubmissionRow }) {
  const [questions, setQuestions] = useState<StandardizedQuestion[] | null>(submission.analysis);
  const [selected, setSelected] = useState<boolean[]>(() => (submission.analysis ?? []).map(() => true));
  const [status, setStatus] = useState<SubmissionStatus>(submission.status);
  const [importedCount, setImportedCount] = useState<number>(submission.importedCount);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [analyzing, startAnalyze] = useTransition();
  const [importing, startImport] = useTransition();
  const [rejecting, startReject] = useTransition();

  const selectedCount = selected.filter(Boolean).length;

  function runAnalyze() {
    setError(null);
    setInfo(null);
    startAnalyze(async () => {
      const r = await analyzeSubmissionAction(submission.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setQuestions(r.questions);
      setSelected(r.questions.map(() => true));
      setStatus("ANALYZED");
    });
  }

  function runImport() {
    setError(null);
    setInfo(null);
    const indexes = selected.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
    if (indexes.length === 0) {
      setError("לא נבחרו שאלות");
      return;
    }
    startImport(async () => {
      const r = await importSubmissionAction(submission.id, indexes);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setStatus("IMPORTED");
      setImportedCount(r.saved);
      setInfo(
        r.skipped > 0
          ? `${r.saved} נוספו · ${r.skipped} דולגו (כפולות או חסרות שדות)`
          : `${r.saved} שאלות נוספו למרכז התור`
      );
    });
  }

  function runReject() {
    setError(null);
    setInfo(null);
    startReject(async () => {
      const r = await rejectSubmissionAction(submission.id);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setStatus("REJECTED");
    });
  }

  const badge = STATUS_BADGE[status];

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{submission.institute}</span>
            {submission.year != null && <span className="text-muted-foreground">· {submission.year}</span>}
            {submission.chapterHint && <span className="text-muted-foreground">· {submission.chapterHint}</span>}
            {submission.doctorName && <span className="text-muted-foreground">· {submission.doctorName}</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {submission.submitterLabel} · {new Date(submission.createdAt).toLocaleDateString("he-IL")}
            {submission.fileName && <> · קובץ: {submission.fileName}</>}
          </div>
        </div>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", badge.cls)}>{badge.label}</span>
      </div>

      {/* Raw content */}
      <details className="rounded border bg-muted/30">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium">התוכן הגולמי</summary>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap px-3 pb-3 text-xs leading-relaxed" dir="rtl">
          {submission.content}
        </pre>
      </details>

      {error && <p className="rounded bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      {info && (
        <p className="rounded bg-green-100 px-3 py-2 text-sm text-green-800 dark:bg-green-900/30 dark:text-green-300">
          {info}
        </p>
      )}

      {/* Workflow */}
      {status === "IMPORTED" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-green-50 px-3 py-2 text-sm dark:bg-green-950/30">
          <span className="text-green-800 dark:text-green-300">{importedCount} שאלות נוספו למרכז התור</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={runAnalyze}
              disabled={analyzing}
              className="text-primary hover:underline disabled:opacity-50"
            >
              {analyzing ? "מנתח..." : "נתח מחדש"}
            </button>
            <Link href="/admin/queue" className="text-primary hover:underline">
              למרכז התור →
            </Link>
          </div>
        </div>
      ) : status === "REJECTED" ? (
        <p className="text-sm text-muted-foreground">השליחה נדחתה.</p>
      ) : (
        <div className="space-y-3">
          {questions != null && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{questions.length} שאלות זוהו</p>
                <button
                  type="button"
                  onClick={runAnalyze}
                  disabled={analyzing}
                  className="text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {analyzing ? "מנתח..." : "נתח מחדש"}
                </button>
              </div>
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li key={i} className="rounded border p-3">
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={selected[i] ?? false}
                        onChange={(e) =>
                          setSelected((prev) => prev.map((v, j) => (j === i ? e.target.checked : v)))
                        }
                        className="mt-1"
                      />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium">{q.stem}</p>
                        <ol className="space-y-0.5 text-sm text-muted-foreground">
                          {[q.optionA, q.optionB, q.optionC, q.optionD].map((opt, oi) => (
                            <li key={oi}>
                              {OPTION_LABELS[oi]}. {opt}
                            </li>
                          ))}
                        </ol>
                        <p className="text-xs text-muted-foreground">
                          תשובת השולח: {q.submitterAnswer ? ANSWER_LABEL[q.submitterAnswer] : "לא צוינה"} (רמז בלבד)
                        </p>
                      </div>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {questions == null ? (
              <Button onClick={runAnalyze} disabled={analyzing}>
                {analyzing ? "מנתח..." : "נתח עם Gemini"}
              </Button>
            ) : (
              <Button onClick={runImport} disabled={importing || selectedCount === 0}>
                {importing ? "מייבא..." : `הוסף למרכז התור (${selectedCount})`}
              </Button>
            )}
            <Button variant="outline" onClick={runReject} disabled={rejecting}>
              {rejecting ? "..." : "דחה"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
