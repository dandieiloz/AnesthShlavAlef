"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  scanFormattingIssuesAction,
  applyAutoFixAction,
  applyManualFixAction,
  applyBulkAutoFixesAction,
  suggestGeminiFixAction,
} from "./actions";
import type { ScanRecord, ScanResult } from "./types";
import type { IssueSeverity } from "@/lib/formatting-scan";

function recordKey(r: ScanRecord): string {
  return `${r.questionId}:${r.source}:${r.field}:${r.citationIndex ?? "_"}`;
}

const SEVERITY_CLASS: Record<IssueSeverity, string> = {
  error: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200",
  warning: "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-200",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
};

type RowState = {
  done?: boolean;
  busy?: boolean;
  suggestion?: string;
  error?: string;
};

export function FormattingIssuesClient() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [filter, setFilter] = useState<string>("ALL");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [scanning, startScan] = useTransition();
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const setRow = (key: string, patch: RowState) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const runScan = () => {
    setBulkMsg(null);
    startScan(async () => {
      const res = await scanFormattingIssuesAction();
      setResult(res);
      setRows({});
    });
  };

  const ruleCounts = useMemo(() => {
    const m = new Map<string, { label: string; count: number }>();
    for (const r of result?.records ?? []) {
      for (const issue of r.issues) {
        const cur = m.get(issue.ruleId) ?? { label: issue.label, count: 0 };
        cur.count += 1;
        m.set(issue.ruleId, cur);
      }
    }
    return m;
  }, [result]);

  const visibleRecords = useMemo(() => {
    const recs = result?.records ?? [];
    if (filter === "ALL") return recs;
    return recs.filter((r) => r.issues.some((i) => i.ruleId === filter));
  }, [result, filter]);

  const autoFixableCount = useMemo(
    () => (result?.records ?? []).filter((r) => r.autoFixed != null).length,
    [result],
  );

  const runBulk = () => {
    startScan(async () => {
      const { changed } = await applyBulkAutoFixesAction();
      const res = await scanFormattingIssuesAction();
      setResult(res);
      setRows({});
      setBulkMsg(`תוקנו ${changed} שדות אוטומטית.`);
    });
  };

  const tabClass = (active: boolean) =>
    `rounded border px-3 py-1 text-sm ${active ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={runScan}
          disabled={scanning}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {scanning ? "סורק…" : result ? "סרוק מחדש" : "סרוק את המאגר"}
        </button>
        {result && autoFixableCount > 0 && (
          <button
            onClick={runBulk}
            disabled={scanning}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            תקן הכל אוטומטית ({autoFixableCount})
          </button>
        )}
        {result && (
          <span className="text-sm text-muted-foreground">
            נסרקו {result.scannedQuestions} שאלות · {result.totalIssues} בעיות ב-
            {result.records.length} שדות
          </span>
        )}
        {bulkMsg && <span className="text-sm text-emerald-600">{bulkMsg}</span>}
      </div>

      {result && result.records.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilter("ALL")} className={tabClass(filter === "ALL")}>
            הכל ({result.records.length})
          </button>
          {[...ruleCounts.entries()].map(([ruleId, { label, count }]) => (
            <button key={ruleId} onClick={() => setFilter(ruleId)} className={tabClass(filter === ruleId)}>
              {label} ({count})
            </button>
          ))}
        </div>
      )}

      {result && result.records.length === 0 && (
        <p className="text-emerald-600">לא נמצאו בעיות עיצוב. 🎉</p>
      )}

      <ul className="space-y-3">
        {visibleRecords.map((r) => {
          const key = recordKey(r);
          const state = rows[key] ?? {};
          return (
            <li key={key} className="rounded border bg-card p-4 text-card-foreground">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Link
                  href={`/history/${r.questionId}`}
                  className="rounded border px-2 py-0.5 font-mono hover:bg-muted"
                >
                  #{r.questionId}
                </Link>
                <span className="rounded bg-muted px-2 py-0.5 font-medium">{r.fieldLabel}</span>
                {r.issues.map((i) => (
                  <span key={i.ruleId} className={`rounded px-2 py-0.5 ${SEVERITY_CLASS[i.severity]}`}>
                    {i.label} ×{i.count}
                  </span>
                ))}
              </div>

              <p className="mt-2 text-sm text-muted-foreground" dir="auto">
                {r.stemPreview}
              </p>

              {state.done ? (
                <p className="mt-3 text-sm text-emerald-600">✓ תוקן ונשמר.</p>
              ) : (
                <>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-xs font-semibold text-muted-foreground">לפני</div>
                      <pre
                        dir="auto"
                        className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/60 p-2 text-xs"
                      >
                        {r.original}
                      </pre>
                    </div>
                    {(r.autoFixed ?? state.suggestion) != null && (
                      <div>
                        <div className="mb-1 text-xs font-semibold text-emerald-600">
                          {state.suggestion != null ? "הצעת Gemini" : "אחרי (תיקון אוטומטי)"}
                        </div>
                        <pre
                          dir="auto"
                          className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-emerald-50 p-2 text-xs dark:bg-emerald-950/40"
                        >
                          {state.suggestion ?? r.autoFixed}
                        </pre>
                      </div>
                    )}
                  </div>

                  {state.error && <p className="mt-2 text-sm text-red-600">{state.error}</p>}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.autoFixed != null && (
                      <button
                        disabled={state.busy}
                        onClick={async () => {
                          setRow(key, { busy: true, error: undefined });
                          const res = await applyAutoFixAction({
                            questionId: r.questionId,
                            source: r.source,
                            field: r.field,
                            citationIndex: r.citationIndex,
                          });
                          setRow(key, { busy: false, done: res.ok, error: res.ok ? undefined : "התיקון נכשל." });
                        }}
                        className="rounded bg-emerald-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                      >
                        החל תיקון אוטומטי
                      </button>
                    )}

                    {state.suggestion != null ? (
                      <button
                        disabled={state.busy}
                        onClick={async () => {
                          setRow(key, { busy: true, error: undefined });
                          const res = await applyManualFixAction({
                            questionId: r.questionId,
                            source: r.source,
                            field: r.field,
                            citationIndex: r.citationIndex,
                            value: state.suggestion!,
                          });
                          setRow(key, { busy: false, done: res.ok, error: res.ok ? undefined : "התיקון נכשל." });
                        }}
                        className="rounded bg-indigo-600 px-3 py-1 text-sm text-white disabled:opacity-50"
                      >
                        החל את הצעת Gemini
                      </button>
                    ) : (
                      <button
                        disabled={state.busy}
                        onClick={async () => {
                          setRow(key, { busy: true, error: undefined });
                          const res = await suggestGeminiFixAction({
                            questionId: r.questionId,
                            source: r.source,
                            field: r.field,
                            citationIndex: r.citationIndex,
                          });
                          setRow(key, {
                            busy: false,
                            suggestion: res.ok ? res.suggestion : undefined,
                            error: res.ok ? undefined : "Gemini לא החזיר הצעה.",
                          });
                        }}
                        className="rounded border px-3 py-1 text-sm hover:bg-muted disabled:opacity-50"
                      >
                        {state.busy ? "חושב…" : "הצע תיקון עם Gemini"}
                      </button>
                    )}

                    <Link
                      href={`/history/${r.questionId}`}
                      className="rounded border px-3 py-1 text-sm hover:bg-muted"
                    >
                      פתח שאלה
                    </Link>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
