"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import {
  parseMultipleQuestionsAction,
  checkBatchDuplicatesAction,
  saveMultipleQuestionsAction,
  type WizardMultiParseResult,
  type BatchDupeResult,
  type QueueItem,
  type SaveMultipleResult,
} from "@/app/admin/new-question/actions";
import type { ParsedQuestion } from "@/lib/wizard";
import { QUESTION_SOURCES } from "@/lib/hospitals";

type Chapter = { number: number; title: string; ingested: boolean };

type BatchEntry = ParsedQuestion & {
  uid: number;
  correctAnswer: "A" | "B" | "C" | "D" | "";
  isDupe: boolean;
  dupeId: number | null;
  dupeForce: boolean;
};

const OPTION_LABELS = ["א", "ב", "ג", "ד"] as const;
const CORRECT_LABELS: Record<string, string> = { A: "א", B: "ב", C: "ג", D: "ד" };

/** Mirror of the server-side normalize for client-side queue dedup. */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[\s.,\-/'“”‘’?!:;()[\]{}<>|\\@#$%^&*+=~–—]/g, "");
}

export function WizardClient({ chapters }: { chapters: Chapter[] }) {
  const [rawText, setRawText] = useState("");
  const [parsing, startParsing] = useTransition();
  const [saving, startSaving] = useTransition();
  const [batch, setBatch] = useState<BatchEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [saveResult, setSaveResult] = useState<SaveMultipleResult | null>(null);
  const [sourceInstitution, setSourceInstitution] = useState("");
  const [sourceYear, setSourceYear] = useState("2026");

  function handleParse() {
    setError(null);
    setBatch(null);
    startParsing(async () => {
      const r: WizardMultiParseResult = await parseMultipleQuestionsAction(rawText);
      if (!r.ok) { setError(r.error); return; }
      const base = Date.now();
      const initial: BatchEntry[] = r.parsed.map((q, i) => ({
        ...q, uid: base + i, correctAnswer: "",
        isDupe: false, dupeId: null, dupeForce: false,
      }));
      setBatch(initial);
      // Single DB round-trip to check all stems against existing questions
      const dupes: BatchDupeResult = await checkBatchDuplicatesAction(r.parsed.map((q) => q.stem));
      setBatch(initial.map((e, i) => ({
        ...e,
        isDupe: dupes[i] !== null,
        dupeId: dupes[i]?.existingId ?? null,
      })));
    });
  }

  function updateBatch(uid: number, update: Partial<BatchEntry>) {
    setBatch((prev) => prev?.map((e) => (e.uid === uid ? { ...e, ...update } : e)) ?? null);
  }

  function removeBatchItem(uid: number) {
    setBatch((prev) => {
      const next = prev?.filter((e) => e.uid !== uid);
      return next && next.length > 0 ? next : null;
    });
  }

  function addAllToQueue() {
    if (!batch) return;
    const source = sourceInstitution && sourceYear ? `${sourceInstitution} ${sourceYear}` : null;
    let queueDupeCount = 0;
    let dbDupeSkipped = 0;
    const toAdd: QueueItem[] = [];
    for (const entry of batch) {
      if (!entry.stem.trim()) continue;
      if (entry.isDupe && !entry.dupeForce) { dbDupeSkipped++; continue; }
      if (queue.some((q) => normalize(q.stem) === normalize(entry.stem))) { queueDupeCount++; continue; }
      const ca =
        entry.correctAnswer === "A" || entry.correctAnswer === "B" ||
        entry.correctAnswer === "C" || entry.correctAnswer === "D"
          ? entry.correctAnswer : null;
      toAdd.push({ stem: entry.stem, optionA: entry.optionA, optionB: entry.optionB,
        optionC: entry.optionC, optionD: entry.optionD,
        correctAnswer: ca, source });
    }
    if (toAdd.length > 0) { setQueue((q) => [...q, ...toAdd]); setBatch(null); setRawText(""); setError(null); }
    const msgs: string[] = [];
    if (queueDupeCount > 0) msgs.push(`${queueDupeCount} שאלות כבר בתור — דולגו`);
    if (dbDupeSkipped > 0) msgs.push(`${dbDupeSkipped} כפולות נדחו — לחץ "הוסף בכל זאת" על כל אחת לכלול`);
    if (msgs.length > 0) setError(msgs.join(" | "));
  }

  function removeFromQueue(idx: number) {
    setQueue((q) => q.filter((_, i) => i !== idx));
  }

  function handleSaveAll() {
    startSaving(async () => {
      const items: QueueItem[] = queue;
      const r = await saveMultipleQuestionsAction(items);
      setSaveResult(r);
      setQueue([]);
    });
  }

  if (saveResult) {
    return (
      <div className="space-y-4">
        <div className="rounded border bg-card p-4 space-y-3">
          <h2 className="text-lg font-semibold">תוצאות שמירה</h2>
          {saveResult.saved.length > 0 && (
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">{saveResult.saved.length} שאלות נשמרו בהצלחה — נוספו לתור לחילול הסבר:</p>
              <ul className="mt-2 space-y-1">
                {saveResult.saved.map((q) => (
                  <li key={q.id}>
                    <Link href={`/admin/questions/${q.id}`} className="text-sm text-primary hover:underline">
                      {q.stem.length > 70 ? q.stem.slice(0, 70) + "..." : q.stem}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {saveResult.skipped.length > 0 && (
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">{saveResult.skipped.length} שאלות דולגו — כבר קיימות במאגר:</p>
              <ul className="mt-2 space-y-1">
                {saveResult.skipped.map((q, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">
                      {q.stem.length > 70 ? q.stem.slice(0, 70) + "..." : q.stem}
                    </span>
                    <Link href={`/admin/questions/${q.existingId}`} className="text-xs text-primary hover:underline whitespace-nowrap">
                      → צפייה בשאלה קיימת
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {saveResult.errors.length > 0 && (
            <div>
              <p className="text-sm font-medium text-destructive">{saveResult.errors.length} שגיאות:</p>
              <ul className="mt-1 space-y-0.5">
                {saveResult.errors.map((e, i) => (
                  <li key={i} className="text-sm text-destructive">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/queue"
            className="flex items-center rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            מעבר למרכז התור →
          </Link>
          <button
            onClick={() => setSaveResult(null)}
            className="rounded border px-4 py-2 text-sm hover:bg-muted"
          >
            הוסף עוד שאלות
          </button>
          <Link
            href="/admin"
            className="flex items-center rounded border px-4 py-2 text-sm hover:bg-muted"
          >
            ← חזרה לניהול
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source */}
      <section className="rounded border bg-card p-4">
        <h2 className="text-base font-semibold">מקור השאלות</h2>
        <p className="text-xs text-muted-foreground mt-0.5">ייושם על כל השאלות בתור</p>
        <div className="mt-2 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">מוסד</label>
            <select
              value={sourceInstitution}
              onChange={(e) => setSourceInstitution(e.target.value)}
              className="rounded border p-1 text-sm bg-background text-foreground"
            >
              <option value="">— ללא מוסד —</option>
              {QUESTION_SOURCES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">שנה</label>
            <input
              type="number"
              min={1990}
              max={2030}
              value={sourceYear}
              onChange={(e) => setSourceYear(e.target.value)}
              className="w-24 rounded border p-1 text-sm bg-background text-foreground"
            />
          </div>
          {sourceInstitution && sourceYear && (
            <span className="text-xs text-muted-foreground pb-1">· מקור: {sourceInstitution} {sourceYear}</span>
          )}
        </div>
      </section>

      {/* Step 1 */}
      <section className="rounded border bg-card p-4">
        <h2 className="text-lg font-semibold">שלב 1: הדבק טקסט גולמי</h2>
        <p className="text-sm text-muted-foreground mt-1">
          הדבק שאלה אחת או יותר. הסיסטם יחלץ אוטומטית את כל השאלות שבטקסט.
        </p>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={12}
          placeholder="לדוגמה: כיצד משפיעה היפותרמיה על CMRO₂?&#10;א. מעלה CMRO₂&#10;ב. אינה משפיעה&#10;ג. מורידה ב־1–2% לכל מעלה&#10;ד. מורידה ב־6–7% לכל מעלה"
          className="mt-2 w-full rounded border p-2 font-mono text-sm bg-background text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={handleParse}
          disabled={parsing || rawText.trim().length < 20}
          className="mt-2 rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {parsing ? "מנתח..." : "נתח עם Gemini"}
        </button>
      </section>

      {error && (
        <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-300">
          שגיאה: {error}
        </div>
      )}

      {/* Step 2: Batch review */}
      {batch && batch.length > 0 && (() => {
        const anyIngested = chapters.some((c) => c.ingested);
        const dupeCount = batch.filter((e) => e.isDupe && !e.dupeForce).length;
        const addableCount = batch.filter(
          (e) => e.stem.trim() && (!e.isDupe || e.dupeForce) && !queue.some((q) => normalize(q.stem) === normalize(e.stem))
        ).length;
        return (
          <section className="rounded border bg-card p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">שלב 2: {batch.length} שאלות זוהו — בדוק ואשר</h2>
                {dupeCount > 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">{dupeCount} כפולות זוהו — מסומנות למטה</p>
                )}
              </div>
            </div>

            {!anyIngested && (
              <p className="rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                ⚠ אין פרקים שנטענו עדיין — חילול ההסברים לא יפעל עד שיטען לפחות פרק אחד
              </p>
            )}

            {batch.map((entry, batchIdx) => (
              <div key={entry.uid}
                className={`rounded border p-3 space-y-2 ${
                  entry.isDupe && !entry.dupeForce ? "bg-amber-50 dark:bg-amber-950/30 opacity-75" : "bg-muted/30"
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">שאלה {batchIdx + 1} / {batch.length}</span>
                  <button type="button" onClick={() => removeBatchItem(entry.uid)}
                    className="text-lg leading-none text-muted-foreground hover:text-destructive" title="הסר">×</button>
                </div>

                {entry.isDupe && !entry.dupeForce && (
                  <div className="flex items-center justify-between gap-2 rounded bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
                    <span>⚠ שאלה זו כבר קיימת במאגר — לא תתווסף</span>
                    <div className="flex gap-3 shrink-0">
                      <Link href={`/admin/questions/${entry.dupeId}`} target="_blank"
                        className="underline hover:text-amber-900">צפה בקיימת ↗</Link>
                      <button type="button"
                        onClick={() => updateBatch(entry.uid, { dupeForce: true })}
                        className="font-semibold underline hover:text-amber-900">הוסף בכל זאת</button>
                    </div>
                  </div>
                )}
                {entry.isDupe && entry.dupeForce && (
                  <div className="flex items-center justify-between gap-2 rounded bg-sky-50 dark:bg-sky-900/30 border border-sky-200 dark:border-sky-700 px-2 py-1.5 text-xs text-sky-700 dark:text-sky-300">
                    <span>ℹ כפולה — תתווסף לתור</span>
                    <button type="button"
                      onClick={() => updateBatch(entry.uid, { dupeForce: false })}
                      className="underline hover:text-sky-900">בטל</button>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-muted-foreground">גוף השאלה</label>
                  <textarea value={entry.stem} rows={2}
                    onChange={(e) => updateBatch(entry.uid, { stem: e.target.value })}
                    className="mt-0.5 w-full rounded border p-1.5 text-sm bg-background text-foreground" />
                </div>

                {(["A", "B", "C", "D"] as const).map((letter, i) => (
                  <div key={letter} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">{OPTION_LABELS[i]}</span>
                    <input
                      value={entry[`option${letter}` as `option${typeof letter}`]}
                      onChange={(e) => updateBatch(entry.uid, { [`option${letter}`]: e.target.value } as Partial<BatchEntry>)}
                      className="flex-1 rounded border p-1.5 text-sm bg-background text-foreground" />
                  </div>
                ))}

                <div className="flex flex-wrap items-center gap-4 pt-1.5 border-t">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-medium text-muted-foreground">תשובה נכונה:</label>
                    <select value={entry.correctAnswer}
                      onChange={(e) => updateBatch(entry.uid, { correctAnswer: e.target.value as BatchEntry["correctAnswer"] })}
                      className="rounded border p-0.5 text-sm bg-background text-foreground">
                      <option value="">—</option>
                      <option value="A">א</option>
                      <option value="B">ב</option>
                      <option value="C">ג</option>
                      <option value="D">ד</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-2 pt-1 border-t">
              <button type="button" onClick={addAllToQueue}
                disabled={addableCount === 0}
                className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">
                הוסף {addableCount} שאלות לתור
                {dupeCount > 0 && ` (${dupeCount} כפולות נדחות)`}
              </button>
              <button type="button"
                onClick={() => { setBatch(null); setRawText(""); setError(null); }}
                className="rounded border px-4 py-2 text-sm hover:bg-muted">
                בטל
              </button>
            </div>
          </section>
        );
      })()}

      {/* Step 3: Queue */}
      {queue.length > 0 && (
        <section className="rounded border bg-card p-4 space-y-3">
          <h2 className="text-lg font-semibold">שלב 3: תור שאלות ({queue.length} שאלות)</h2>
          <div className="space-y-2">
            {queue.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-3 rounded border bg-muted/30 p-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.stem.length > 80 ? item.stem.slice(0, 80) + "..." : item.stem}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.correctAnswer && (
                      <span className="mr-2">· תשובה נכונה: {CORRECT_LABELS[item.correctAnswer]}</span>
                    )}
                    {item.source && (
                      <span className="mr-2">· מקור: {item.source}</span>
                    )}
                    <span className="mr-2 inline-block rounded bg-primary/15 dark:bg-primary/20 px-1 text-primary">+ לתור הסברים</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => removeFromQueue(idx)}
                  className="flex-shrink-0 text-lg leading-none text-muted-foreground hover:text-destructive"
                  title="הסר מהתור"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50"
          >
            {saving ? "שומר..." : `שמור הכל (${queue.length} שאלות)`}
          </button>
        </section>
      )}
    </div>
  );
}
