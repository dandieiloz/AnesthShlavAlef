"use client";
import { useState, useTransition } from "react";
import { setPublishConfidenceThresholdAction } from "./actions";

export function PublishThresholdControl({ initialThreshold, filteredCount }: { initialThreshold: number; filteredCount: number }) {
  const [pct, setPct] = useState<string>(String(Math.round(initialThreshold * 100)));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    const n = Number(pct);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("הזן מספר בין 0 ל-100");
      return;
    }
    start(async () => {
      try {
        await setPublishConfidenceThresholdAction(n / 100);
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בשמירה");
      }
    });
  }

  return (
    <div className="rounded border bg-card p-4">
      <h2 className="text-sm font-semibold mb-1">סף ביטחון לפרסום</h2>
      <p className="text-xs text-muted-foreground mb-3">
        שאלות יוצגו למשתמשים רק אם ביטחון ההסבר ≥ הסף, או שאושרו ידנית על ידי מנהל.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">סף (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={pct}
            onChange={(e) => { setPct(e.target.value); setSavedAt(null); }}
            className="w-24 rounded border p-1.5 text-sm bg-background text-foreground"
          />
        </div>
        <button
          onClick={save}
          disabled={pending}
          className="rounded bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-4 py-1.5 text-sm disabled:opacity-50"
        >
          {pending ? "שומר..." : "שמור"}
        </button>
        {savedAt !== null && !pending && (
          <span className="text-xs text-green-700 dark:text-green-400">✓ נשמר</span>
        )}
        {error && (
          <span className="text-xs text-red-700 dark:text-red-400">{error}</span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        מסנן כעת <strong>{filteredCount}</strong> שאלות מהמשתמשים
      </p>
    </div>
  );
}
