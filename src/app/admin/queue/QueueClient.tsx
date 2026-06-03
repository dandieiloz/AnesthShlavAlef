"use client";
import { useState, useEffect, useTransition, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JobStatus, JobKind } from "@prisma/client";
import {
  runJobAction,
  cancelJobsAction,
  retryJobsAction,
  cleanupDoneJobsAction,
  enqueueInitialJobAction,
  enqueueRegenerationAction,
  enqueueRegenerationBatchAction,
  estimateJobsCostAction,
  type RunJobResult,
  type CostEstimateResult,
} from "./actions";

export type QueueJobRow = {
  id: number;
  questionId: number;
  stem: string;
  source: string | null;
  chapterNumber: number;
  chapterTitle: string;
  hasAnswer: boolean;
  status: JobStatus;
  kind: JobKind;
  attempts: number;
  lastError: string | null;
  queuedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  regenerationHint: string | null;
};

export type UnansweredQuestion = {
  id: number;
  stem: string;
  source: string | null;
  chapterNumber: number;
  chapterTitle: string;
};

export type LowQualityQuestion = UnansweredQuestion & {
  /** [0,1], or null if no answer */
  confidence: number | null;
  escalated: boolean;
  insufficientEvidence: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: "ממתין",
  PROCESSING: "בעיבוד...",
  DONE: "הושלם ✓",
  FAILED: "נכשל ✗",
  CANCELLED: "בוטל",
};

const STATUS_CLASS: Record<JobStatus, string> = {
  PENDING: "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300",
  PROCESSING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 animate-pulse",
  DONE: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  FAILED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

const KIND_LABEL: Record<JobKind, string> = {
  INITIAL: "ראשוני",
  REGENERATE: "חילול מחדש",
};

/** Format a millisecond duration as a short human-readable Hebrew string. */
function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)} שנ'`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return s > 0 ? `${m}:${String(s).padStart(2, "0")} דק'` : `${m} דק'`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function QueueClient({
  rows: initialRows,
  unansweredQuestions: initialUnanswered = [],
  lowQualityQuestions: initialLowQuality = [],
}: {
  rows: QueueJobRow[];
  unansweredQuestions?: UnansweredQuestion[];
  lowQualityQuestions?: LowQualityQuestion[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<QueueJobRow[]>(initialRows);
  const [unanswered, setUnanswered] = useState<UnansweredQuestion[]>(initialUnanswered);
  const [lowQuality, setLowQuality] = useState<LowQualityQuestion[]>(initialLowQuality);
  const [hintModalQ, setHintModalQ] = useState<LowQualityQuestion | null>(null);
  const [hintText, setHintText] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const stopRef = useRef(false);
  const [, startTransition] = useTransition();

  // ── Cost estimation ───────────────────────────────────────────────────────
  const [estimate, setEstimate] = useState<CostEstimateResult | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const estimateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Time tracking (in-progress countdown) ────────────────────────────────
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);
  const jobStartedAtRef = useRef<number | null>(null);  // timestamp before each job
  const jobTimingsRef = useRef<number[]>([]);           // ms per completed job (rolling)

  // ── Derived ──────────────────────────────────────────────────────────────

  const runnable = rows.filter(
    (r) => selected.has(r.id) && (r.status === "PENDING" || r.status === "FAILED")
  );

  // Stable string key used as the useEffect dependency for the cost estimator.
  const runnableKey = useMemo(
    () => runnable.map((r) => r.id).sort().join(","),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, rows],
  );

  // ── Debounced cost estimation on selection change ─────────────────────────
  useEffect(() => {
    if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    if (runnableKey === "") {
      setEstimate(null);
      setEstimating(false);
      setConfirmPending(false);
      return;
    }
    setEstimating(true);
    estimateTimerRef.current = setTimeout(async () => {
      try {
        const ids = runnableKey.split(",").map(Number);
        const result = await estimateJobsCostAction(ids);
        setEstimate(result);
      } catch {
        setEstimate(null);
      } finally {
        setEstimating(false);
      }
    }, 400);
    return () => {
      if (estimateTimerRef.current) clearTimeout(estimateTimerRef.current);
    };
  }, [runnableKey]);

  // ── Live countdown ticker ───────────────────────────────────────────────────
  useEffect(() => {
    if (!running) {
      setTimeRemaining(null);
      return;
    }
    const id = setInterval(() => {
      if (!progress) return;
      const remaining = progress.total - progress.current;
      if (remaining <= 0) { setTimeRemaining(null); return; }
      // Prefer rolling average of actual timings; fall back to server estimate.
      const avgMs =
        jobTimingsRef.current.length > 0
          ? jobTimingsRef.current.reduce((a, b) => a + b, 0) / jobTimingsRef.current.length
          : (estimate?.avgLatencyMs ?? 30_000);
      setTimeRemaining(formatDuration(remaining * avgMs));
    }, 1_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const retryable = rows.filter(
    (r) => selected.has(r.id) && (r.status === "FAILED" || r.status === "CANCELLED")
  );
  const cancellable = rows.filter(
    (r) => selected.has(r.id) && (r.status === "PENDING" || r.status === "FAILED")
  );

  // ── Row update helper ──────────────────────────────────────────────────────

  function updateRow(jobId: number, patch: Partial<QueueJobRow>) {
    setRows((prev) => prev.map((r) => (r.id === jobId ? { ...r, ...patch } : r)));
  }

  // ── Selection ─────────────────────────────────────────────────────────────

  function toggleAll() {
    const runnableIds = rows
      .filter((r) => r.status === "PENDING" || r.status === "FAILED")
      .map((r) => r.id);
    const allSelected = runnableIds.every((id) => selected.has(id));
    setSelected(allSelected ? new Set() : new Set(runnableIds));
  }

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // ── Run loop ─────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (runnable.length === 0) return;
    setConfirmPending(false);
    stopRef.current = false;
    setRunning(true);
    setStatusMsg(null);
    jobTimingsRef.current = [];

    const queue = runnable.map((r) => r.id);
    let doneCount = 0;
    let failCount = 0;

    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) {
        setStatusMsg(`עצר לאחר ${i} / ${queue.length} משימות`);
        break;
      }
      const jobId = queue[i];
      setProgress({ current: i + 1, total: queue.length });
      updateRow(jobId, { status: "PROCESSING" });
      jobStartedAtRef.current = Date.now();

      const result: RunJobResult = await runJobAction(jobId);
      const elapsed = Date.now() - (jobStartedAtRef.current ?? Date.now());

      if (result.ok) {
        doneCount++;
        jobTimingsRef.current.push(elapsed);
        updateRow(jobId, { status: "DONE", finishedAt: new Date().toISOString() });
      } else if (result.status === "FAILED") {
        failCount++;
        jobTimingsRef.current.push(elapsed);
        updateRow(jobId, {
          status: "FAILED",
          lastError: result.error ?? "שגיאה לא ידועה",
          finishedAt: new Date().toISOString(),
        });
      } else {
        // NOT_CLAIMABLE — already claimed by another admin (no timing recorded)
        updateRow(jobId, { status: "PROCESSING" });
        setStatusMsg(`משימה ${jobId} כבר בעיבוד על-ידי מישהו אחר`);
      }
    }

    setRunning(false);
    setProgress(null);
    if (!stopRef.current) {
      setStatusMsg(
        `סיים: ${doneCount} הושלמו${failCount > 0 ? `, ${failCount} נכשלו` : ""}`
      );
    }
    // Refresh server data so stats bar / filter counts update
    router.refresh();
  }, [runnable, router]);

  const handleStop = useCallback(() => {
    stopRef.current = true;
  }, []);

  // ── Start-with-confirmation gate ──────────────────────────────────────────
  const handleStartRequest = useCallback(() => {
    if (
      estimate &&
      estimate.totalUsd > estimate.confirmThreshold &&
      !confirmPending
    ) {
      setConfirmPending(true);
    } else {
      handleStart();
    }
  }, [estimate, confirmPending, handleStart]);

  // ── Cancel selected ────────────────────────────────────────────────────────

  const handleCancel = useCallback(() => {
    const ids = cancellable.map((r) => r.id);
    startTransition(async () => {
      await cancelJobsAction(ids);
      ids.forEach((id) => updateRow(id, { status: "CANCELLED" }));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      router.refresh();
    });
  }, [cancellable, router]);

  // ── Retry selected ────────────────────────────────────────────────────────

  const handleRetry = useCallback(() => {
    const ids = retryable.map((r) => r.id);
    startTransition(async () => {
      await retryJobsAction(ids);
      ids.forEach((id) =>
        updateRow(id, { status: "PENDING", lastError: null, startedAt: null, finishedAt: null })
      );
      router.refresh();
    });
  }, [retryable, router]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const handleCleanup = useCallback(() => {
    startTransition(async () => {
      const deleted = await cleanupDoneJobsAction(7);
      setStatusMsg(`נמחקו ${deleted} משימות ישנות (הושלמו/בוטלו לפני 7+ ימים)`);
      router.refresh();
    });
  }, [router]);

  // ── Enqueue a single unanswered question ────────────────────────────────────

  const handleEnqueueOne = useCallback(
    (questionId: number) => {
      startTransition(async () => {
        const result = await enqueueInitialJobAction(questionId);
        if (result.ok) {
          // Remove from unanswered list immediately; server refresh will add it to jobs
          setUnanswered((prev) => prev.filter((q) => q.id !== questionId));
          router.refresh();
        }
      });
    },
    [router]
  );

  // ── Enqueue all unanswered questions ─────────────────────────────────────────

  const handleEnqueueAll = useCallback(() => {
    startTransition(async () => {
      const ids = unanswered.map((q) => q.id);
      // Sequential to avoid constraint violations; fast enough for typical counts
      for (const questionId of ids) {
        await enqueueInitialJobAction(questionId);
      }
      setUnanswered([]);
      router.refresh();
    });
  }, [unanswered, router]);

  // ── Regenerate one low-quality question ───────────────────────────

  const handleRegenerateOne = useCallback(
    (questionId: number, hint?: string) => {
      startTransition(async () => {
        const result = await enqueueRegenerationAction(questionId, hint ?? null);
        if (result.ok) {
          setLowQuality((prev) => prev.filter((q) => q.id !== questionId));
          router.refresh();
        }
      });
    },
    [router],
  );

  const openHintModal = useCallback((q: LowQualityQuestion) => {
    setHintModalQ(q);
    setHintText("");
  }, []);

  const closeHintModal = useCallback(() => {
    setHintModalQ(null);
    setHintText("");
  }, []);

  const submitHintModal = useCallback(() => {
    if (!hintModalQ) return;
    const qId = hintModalQ.id;
    const hint = hintText.trim() || undefined;
    closeHintModal();
    handleRegenerateOne(qId, hint);
  }, [hintModalQ, hintText, closeHintModal, handleRegenerateOne]);

  // ── Bulk regenerate all low-quality questions ───────────────────────

  const handleRegenerateAll = useCallback(() => {
    startTransition(async () => {
      const ids = lowQuality.map((q) => q.id);
      const result = await enqueueRegenerationBatchAction(ids);
      setLowQuality([]);
      setStatusMsg(
        result.skipped > 0
          ? `הוספו ${result.enqueued} משימות חילול מחדש (${result.skipped} דולגו — כבר בתור)`
          : `הוספו ${result.enqueued} משימות חילול מחדש`,
      );
      router.refresh();
    });
  }, [lowQuality, router]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Unanswered questions without a queued job */}
      {unanswered.length > 0 && (
        <div className="rounded border border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-orange-800 dark:text-orange-300">
              {unanswered.length} שאלות ללא הסבר וללא משימה פתוחה
            </p>
            <button
              onClick={handleEnqueueAll}
              className="rounded bg-orange-600 px-3 py-1.5 text-sm text-white hover:bg-orange-700"
            >
              הוסף הכל לתור ({unanswered.length})
            </button>
          </div>
          <div className="rounded border overflow-x-auto bg-white dark:bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-right font-medium">שאלה</th>
                  <th className="w-20 px-3 py-2 text-center font-medium">פרק</th>
                  <th className="w-28 px-3 py-2 text-center font-medium">פעולה</th>
                </tr>
              </thead>
              <tbody>
                {unanswered.map((q) => (
                  <tr key={q.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2 max-w-xs">
                      <Link
                        href={`/admin/questions/${q.id}`}
                        className="text-primary hover:underline font-medium line-clamp-2"
                        title={q.stem}
                      >
                        {q.stem.length > 90 ? q.stem.slice(0, 90) + "…" : q.stem}
                      </Link>
                      {q.source && (
                        <p className="text-xs text-muted-foreground mt-0.5">{q.source}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                      {q.chapterNumber}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleEnqueueOne(q.id)}
                        className="rounded border px-2 py-1 text-xs hover:bg-muted"
                      >
                        + לתור
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Low-quality answers panel */}
      {lowQuality.length > 0 && (
        <div className="rounded border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
              {lowQuality.length} שאלות עם תשובה באיכות נמוכה (ללא משימה פתוחה)
            </p>
            <button
              onClick={handleRegenerateAll}
              className="rounded bg-rose-600 px-3 py-1.5 text-sm text-white hover:bg-rose-700"
            >
              חולל מחדש הכל ({lowQuality.length})
            </button>
          </div>
          <p className="text-xs text-rose-700/80 dark:text-rose-300/80">
            תשובות עם ביטחון נמוך מ־70%, סומנו Escalated, או שהמודל הצהיר על ראיות חסרות.
          </p>
          <div className="rounded border overflow-x-auto bg-white dark:bg-background">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-right font-medium">שאלה</th>
                  <th className="w-20 px-3 py-2 text-center font-medium">פרק</th>
                  <th className="w-44 px-3 py-2 text-center font-medium">סיבה</th>
                  <th className="w-28 px-3 py-2 text-center font-medium">פעולה</th>
                </tr>
              </thead>
              <tbody>
                {lowQuality.map((q) => {
                  const pct = q.confidence === null ? null : Math.round(q.confidence * 100);
                  return (
                    <tr key={q.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 max-w-xs">
                        <Link
                          href={`/admin/questions/${q.id}`}
                          className="text-primary hover:underline font-medium line-clamp-2"
                          title={q.stem}
                        >
                          {q.stem.length > 90 ? q.stem.slice(0, 90) + "…" : q.stem}
                        </Link>
                        {q.source && (
                          <p className="text-xs text-muted-foreground mt-0.5">{q.source}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                        {q.chapterNumber}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex flex-wrap justify-center gap-1">
                          {pct !== null && pct < 70 && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs font-mono ${
                                pct < 50
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                                  : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                              }`}
                            >
                              {pct}%
                            </span>
                          )}
                          {q.escalated && (
                            <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                              Escalated
                            </span>
                          )}
                          {q.insufficientEvidence && (
                            <span className="rounded bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-xs text-red-800 dark:text-red-300">
                              ראיות חסרות
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => openHintModal(q)}
                          className="rounded border px-2 py-1 text-xs hover:bg-muted"
                        >
                          + חולל מחדש
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cost estimate */}
      {runnable.length > 0 && !running && (
        <div className="rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 px-4 py-2 text-sm">
          {estimating ? (
            <span className="text-muted-foreground animate-pulse">מחשב עלות…</span>
          ) : estimate ? (
            <details>
              <summary className="cursor-pointer select-none list-none flex flex-wrap items-center gap-2">
                <span className="font-medium text-blue-800 dark:text-blue-300">
                  עלות מוערכת:{" "}
                  <span className="font-mono">${estimate.totalUsd.toFixed(4)}</span>
                </span>
                <span className="text-blue-700 dark:text-blue-400">
                  · זמן מוערך:{" "}
                  <span className="font-medium">
                    ~{formatDuration(
                      estimate.avgLatencyMs *
                        Math.max(1, estimate.jobCount - estimate.cachedCount),
                    )}
                  </span>
                  {estimate.avgLatencyMs === 30_000 && (
                    <span className="opacity-60"> (אין היסטוריה)</span>
                  )}
                </span>
                {estimate.cachedCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({estimate.cachedCount} מתוך {estimate.jobCount} ממטמון — חינם)
                  </span>
                )}
                <span className="text-xs text-muted-foreground mr-auto opacity-70">▼ פירוט שלבים</span>
              </summary>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-xs text-muted-foreground max-w-xs">
                <span>הטמעה (עברית):</span>
                <span className="font-mono">${estimate.byStage.embedHe.toFixed(5)}</span>
                <span>תרגום לאנגלית:</span>
                <span className="font-mono">${estimate.byStage.translate.toFixed(5)}</span>
                <span>הטמעה (אנגלית):</span>
                <span className="font-mono">${estimate.byStage.embedEn.toFixed(5)}</span>
                <span>דירוג מחדש (Flash):</span>
                <span className="font-mono">${estimate.byStage.rerank.toFixed(5)}</span>
                <span>חילול עיקרי (Pro):</span>
                <span className="font-mono">${estimate.byStage.primaryGen.toFixed(5)}</span>
                <span>ניסיון חוזר (~{estimate.escalationPct}% Pro):</span>
                <span className="font-mono">${estimate.byStage.escalation.toFixed(5)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground opacity-70">
                * הערכה גסה ±25% — מחירון Gemini רשמי
              </p>
            </details>
          ) : null}
        </div>
      )}

      {/* Confirm gate banner */}
      {confirmPending && (
        <div className="rounded border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm flex flex-wrap items-center gap-3">
          <span className="font-medium text-amber-800 dark:text-amber-300">
            עלות גבוהה מ-${estimate?.confirmThreshold.toFixed(2)} — האם להמשיך?
            {estimate && (
              <span className="font-mono ml-1">(~${estimate.totalUsd.toFixed(4)})</span>
            )}
          </span>
          <button
            onClick={handleStart}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700"
          >
            ✓ כן, הפעל
          </button>
          <button
            onClick={() => setConfirmPending(false)}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            ✕ ביטול
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {!running ? (
          <button
            onClick={handleStartRequest}
            disabled={runnable.length === 0}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            ▶ הפעל {runnable.length} משימות נבחרות
          </button>
        ) : (
          <button
            onClick={handleStop}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            ■ עצור לאחר המשימה הנוכחית
          </button>
        )}

        {retryable.length > 0 && (
          <button
            onClick={handleRetry}
            disabled={running}
            className="rounded border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
          >
            ↺ נסה שוב ({retryable.length})
          </button>
        )}

        {cancellable.length > 0 && (
          <button
            onClick={handleCancel}
            disabled={running}
            className="rounded border px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            ✕ בטל ({cancellable.length})
          </button>
        )}

        <button
          onClick={handleCleanup}
          disabled={running}
          className="mr-auto rounded border px-3 py-2 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          מחק משימות ישנות (7+ ימים)
        </button>

        <button
          onClick={() => router.refresh()}
          disabled={running}
          className="rounded border px-3 py-2 text-xs hover:bg-muted disabled:opacity-50"
        >
          ↻ רענן
        </button>
      </div>

      {/* Progress indicator */}
      {progress && (
        <div className="rounded border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-950/30 px-4 py-2 text-sm text-yellow-800 dark:text-yellow-300">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>מעבד {progress.current} / {progress.total} משימות…</span>
            {timeRemaining && (
              <span className="text-xs opacity-80">זמן משוער שנותר: ~{timeRemaining}</span>
            )}
          </div>
          <div className="mt-1 h-1.5 rounded bg-yellow-200 dark:bg-yellow-800">
            <div
              className="h-1.5 rounded bg-yellow-600 transition-all duration-500"
              style={{ width: `${(progress.current / progress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Status message */}
      {statusMsg && !progress && (
        <div className="rounded border bg-muted px-4 py-2 text-sm text-muted-foreground">
          {statusMsg}
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="rounded border bg-card p-8 text-center text-muted-foreground">
          אין משימות להצגה בסינון הנוכחי
        </div>
      ) : (
        <div className="rounded border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    title="בחר הכל"
                    onChange={toggleAll}
                    checked={
                      rows
                        .filter((r) => r.status === "PENDING" || r.status === "FAILED")
                        .every((r) => selected.has(r.id)) &&
                      rows.some((r) => r.status === "PENDING" || r.status === "FAILED")
                    }
                  />
                </th>
                <th className="px-3 py-2 text-right font-medium">שאלה</th>
                <th className="w-20 px-3 py-2 text-center font-medium">פרק</th>
                <th className="w-24 px-3 py-2 text-center font-medium">סוג</th>
                <th className="w-28 px-3 py-2 text-center font-medium">סטטוס</th>
                <th className="w-16 px-3 py-2 text-center font-medium">ניסיונות</th>
                <th className="w-28 px-3 py-2 text-center font-medium">הוסף לתור</th>
                <th className="w-20 px-3 py-2 text-center font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b last:border-0 ${
                    selected.has(row.id) ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                >
                  <td className="px-3 py-2 text-center">
                    {(row.status === "PENDING" || row.status === "FAILED") && (
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleOne(row.id)}
                      />
                    )}
                  </td>

                  <td className="px-3 py-2 max-w-xs">
                    <Link
                      href={`/admin/questions/${row.questionId}`}
                      className="text-primary hover:underline font-medium line-clamp-2"
                      title={row.stem}
                    >
                      {row.stem.length > 90 ? row.stem.slice(0, 90) + "…" : row.stem}
                    </Link>
                    {row.source && (
                      <p className="text-xs text-muted-foreground mt-0.5">{row.source}</p>
                    )}
                    {row.lastError && (
                      <p
                        className="mt-0.5 text-xs text-red-700 dark:text-red-400 line-clamp-2"
                        title={row.lastError}
                      >
                        ✗ {row.lastError}
                      </p>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center text-muted-foreground text-xs">
                    {row.chapterNumber}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs ${
                        row.kind === "REGENERATE"
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {KIND_LABEL[row.kind]}
                    </span>
                    {row.regenerationHint && (
                      <span
                        className="ml-1 cursor-help"
                        title={row.regenerationHint}
                        aria-label="הערת מהאדמין"
                      >
                        💬
                      </span>
                    )}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </td>

                  <td className="px-3 py-2 text-center text-muted-foreground">
                    {row.attempts}
                  </td>

                  <td className="px-3 py-2 text-center text-xs text-muted-foreground">
                    {row.queuedAt ? new Date(row.queuedAt).toLocaleString("he-IL") : "—"}
                  </td>

                  <td className="px-3 py-2 text-center">
                    <div className="flex justify-center gap-1">
                      {(row.status === "FAILED" || row.status === "CANCELLED") && (
                        <button
                          title="נסה שוב"
                          disabled={running}
                          onClick={() => {
                            startTransition(async () => {
                              await retryJobsAction([row.id]);
                              updateRow(row.id, {
                                status: "PENDING",
                                lastError: null,
                                startedAt: null,
                                finishedAt: null,
                              });
                            });
                          }}
                          className="rounded border px-1.5 py-0.5 text-xs hover:bg-muted disabled:opacity-50"
                        >
                          ↺
                        </button>
                      )}
                      {(row.status === "PENDING" || row.status === "FAILED") && (
                        <button
                          title="בטל"
                          disabled={running}
                          onClick={() => {
                            startTransition(async () => {
                              await cancelJobsAction([row.id]);
                              updateRow(row.id, { status: "CANCELLED" });
                            });
                          }}
                          className="rounded border px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hint modal for regenerating a low-quality answer */}
      {hintModalQ && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeHintModal}
        >
          <div
            className="w-full max-w-lg rounded-lg border bg-card p-5 shadow-xl space-y-3"
            onClick={(e) => e.stopPropagation()}
            dir="rtl"
          >
            <h2 className="text-lg font-semibold">חולל מחדש — שאלה #{hintModalQ.id}</h2>
            <p className="text-sm text-muted-foreground line-clamp-3" title={hintModalQ.stem}>
              {hintModalQ.stem}
            </p>
            <div className="flex flex-wrap gap-1">
              {hintModalQ.confidence !== null && Math.round(hintModalQ.confidence * 100) < 70 && (
                <span className="rounded bg-yellow-100 dark:bg-yellow-900/30 px-1.5 py-0.5 text-xs font-mono text-yellow-800 dark:text-yellow-300">
                  ביטחון: {Math.round(hintModalQ.confidence * 100)}%
                </span>
              )}
              {hintModalQ.escalated && (
                <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-xs text-amber-800 dark:text-amber-300">
                  Escalated
                </span>
              )}
              {hintModalQ.insufficientEvidence && (
                <span className="rounded bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-xs text-red-800 dark:text-red-300">
                  ראיות חסרות
                </span>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                הערה / רמז למודל (אופציונלי)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                הסבר בקצרה למה ההסבר הקיים שגוי כדי לעזור למודל לחולל תשובה טובה יותר. לדוגמה:
                &quot;התשובה הנכונה היא B כי...&quot;, &quot;המודל התעלם מהשפעת...&quot;, &quot;המקור הנכון נמצא בפרק X&quot;.
                הראיות עדיין חייבות להגיע מקטעי המקור.
              </p>
              <textarea
                value={hintText}
                onChange={(e) => setHintText(e.target.value)}
                rows={5}
                maxLength={2000}
                className="w-full rounded border p-2 text-sm bg-background text-foreground"
                placeholder="הערה למודל (עד 2000 תווים)..."
                autoFocus
              />
              <p className="mt-1 text-xs text-muted-foreground text-left font-mono">
                {hintText.length} / 2000
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={closeHintModal}
                className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
              >
                ביטול
              </button>
              <Link
                href={`/admin/questions/${hintModalQ.id}`}
                className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
              >
                פתח דף שאלה
              </Link>
              <button
                onClick={submitHintModal}
                className="rounded bg-rose-600 px-4 py-1.5 text-sm text-white hover:bg-rose-700"
              >
                חולל מחדש
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
