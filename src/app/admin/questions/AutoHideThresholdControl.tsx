"use client";
import { useState, useTransition } from "react";
import { setAutoHideThresholdAction } from "./actions";

export function AutoHideThresholdControl({
  initialMinAttempts,
  initialMaxCorrectPercent,
  filteredCount,
}: {
  initialMinAttempts: number;
  initialMaxCorrectPercent: number;
  filteredCount: number;
}) {
  const [minAttempts, setMinAttempts] = useState<string>(String(initialMinAttempts));
  const [maxPct, setMaxPct] = useState<string>(String(Math.round(initialMaxCorrectPercent * 100)));
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function save() {
    setError(null);
    const min = Number(minAttempts);
    const pct = Number(maxPct);
    if (!Number.isInteger(min) || min < 0) {
      setError("הזן מספר שלם ≥ 0 עבור מספר ניסיונות");
      return;
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("הזן אחוז בין 0 ל-100");
      return;
    }
    start(async () => {
      try {
        await setAutoHideThresholdAction(min, pct / 100);
        setSavedAt(Date.now());
      } catch (e) {
        setError(e instanceof Error ? e.message : "שגיאה בשמירה");
      }
    });
  }

  return (
    <div className="rounded border bg-card p-4">
      <h2 className="text-sm font-semibold mb-1">סף הסתרה אוטומטית לפי הצלחה</h2>
      <p className="text-xs text-muted-foreground mb-3">
        שאלות יוסתרו אוטומטית ממשתמשים אם הצטברו לפחות N ניסיונות <strong>וגם</strong> אחוז
        התשובות הנכונות נמוך מהסף. שאלות שאושרו ידנית על ידי מנהל לא יוסתרו. הזן 0 ניסיונות כדי
        לכבות את הכלל.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">מינימום ניסיונות</label>
          <input
            type="number"
            min={0}
            step={1}
            value={minAttempts}
            onChange={(e) => { setMinAttempts(e.target.value); setSavedAt(null); }}
            className="w-24 rounded border p-1.5 text-sm bg-background text-foreground"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">אחוז נכונות מרבי (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            value={maxPct}
            onChange={(e) => { setMaxPct(e.target.value); setSavedAt(null); }}
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
