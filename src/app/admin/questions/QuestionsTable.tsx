"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { GroupCombobox } from "@/components/GroupCombobox";
import { batchUpdateSourceAction, batchDeleteQuestionsAction, batchTranslateMissingAction, batchSetDisabledAction } from "./actions";
import { enqueueRegenerationBatchAction } from "../queue/actions";

export type QuestionRow = {
  id: number;
  stem: string;
  source: string | null;
  createdAt: string;
  chapterNumber: number;
  hasExplanation: boolean;
  disabled: boolean;
  /** Primary correct answer (A/B/C/D), or null when not yet set. */
  correctAnswer: "A" | "B" | "C" | "D" | null;
  /** Number of admin-marked additionally-accepted answers (excludes the primary). 0 = single-answer question. */
  acceptedAnswersCount: number;
  /** Confidence in [0,1] from the GeminiAnswer, or null when no answer exists. */
  confidence: number | null;
  escalated: boolean | null;
  insufficientEvidence: boolean | null;
  /** Last admin hint (רמז) used to generate the answer, or null when none / no answer. */
  generationHint: string | null;
  /** Number of EN translation fields already cached (question + answer combined) */
  translationCount: number;
  attemptCount: number;
  correctCount: number;
  percentCorrect: number | null;
};

type SortField = "id" | "stem" | "source" | "chapter" | "hasExplanation" | "confidence" | "escalated" | "insufficientEvidence" | "translationCount" | "attemptCount" | "percentCorrect" | "createdAt";
type SortOrder = "asc" | "desc";

const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

const DEFAULT_SORT_ORDER: Record<SortField, SortOrder> = {
  id: "desc",
  stem: "asc",
  source: "asc",
  chapter: "asc",
  hasExplanation: "desc",
  confidence: "asc",
  escalated: "desc",
  insufficientEvidence: "desc",
  translationCount: "desc",
  attemptCount: "desc",
  percentCorrect: "desc",
  createdAt: "desc",
};

export function QuestionsTable({
  questions,
  sort,
  order,
}: {
  questions: QuestionRow[];
  sort: SortField;
  order: SortOrder;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [panel, setPanel] = useState<"source" | "delete" | "translate" | "disable" | "enable" | "regenerate" | null>(null);
  const [translateDone, setTranslateDone] = useState<number | null>(null);
  const [regenDone, setRegenDone] = useState<{ enqueued: number; skipped: number } | null>(null);

  // Source edit form state
  const [institution, setInstitution] = useState("");
  const [year, setYear] = useState("");
  const [suffix, setSuffix] = useState("");

  const [pending, startTransition] = useTransition();

  const allIds = questions.map((q) => q.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleUpdateSource() {
    const source =
      institution && year
        ? suffix.trim() ? `${institution} ${year} ${suffix.trim()}` : `${institution} ${year}`
        : institution || year || null;
    startTransition(async () => {
      await batchUpdateSourceAction([...selected], source);
      setSelected(new Set());
      setPanel(null);
      setInstitution("");
      setYear("");
      setSuffix("");
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await batchDeleteQuestionsAction([...selected]);
      setSelected(new Set());
      setPanel(null);
      router.refresh();
    });
  }

  function handleTranslateMissing() {
    startTransition(async () => {
      const count = await batchTranslateMissingAction([...selected]);
      setTranslateDone(count);
      setPanel(null);
      router.refresh();
    });
  }

  function handleRegenerate() {
    startTransition(async () => {
      const result = await enqueueRegenerationBatchAction([...selected]);
      setRegenDone(result);
      setSelected(new Set());
      setPanel(null);
      router.refresh();
    });
  }

  function handleSetDisabled(disabled: boolean) {
    startTransition(async () => {
      await batchSetDisabledAction([...selected], disabled);
      setSelected(new Set());
      setPanel(null);
      router.refresh();
    });
  }

  /** Select all questions that are not yet fully translated */
  function selectPartial() {
    const partialIds = questions
      .filter((q) => q.translationCount < (q.hasExplanation ? 7 : 5))
      .map((q) => q.id);
    setSelected(new Set(partialIds));
  }

  function sortHref(field: SortField) {
    const nextParams = new URLSearchParams(searchParams.toString());
    const nextOrder =
      sort === field
        ? order === "asc"
          ? "desc"
          : "asc"
        : DEFAULT_SORT_ORDER[field];

    nextParams.set("sort", field);
    nextParams.set("order", nextOrder);

    return `${pathname}?${nextParams.toString()}`;
  }

  function sortIndicator(field: SortField) {
    if (sort !== field) return "";
    return order === "asc" ? " ▲" : " ▼";
  }

  function SortHeader({
    field,
    label,
    align = "start",
    className = "",
  }: {
    field: SortField;
    label: string;
    align?: "start" | "center";
    className?: string;
  }) {
    const alignClass = align === "center" ? "text-center" : "text-start";

    return (
      <th className={`p-2 ${alignClass} text-muted-foreground whitespace-nowrap ${className}`.trim()}>
        <Link href={sortHref(field)} className="inline-flex items-center gap-1 hover:text-foreground">
          <span>{label}</span>
          <span aria-hidden="true">{sortIndicator(field)}</span>
        </Link>
      </th>
    );
  }

  return (
    <div className="relative">
      {/* Quick-select helpers row */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <button
          onClick={selectPartial}
          className="rounded border px-3 py-1.5 text-xs hover:bg-muted"
        >
          בחר כל החלקיים / חסרים
        </button>
        {translateDone !== null && (
          <span className="text-xs text-green-700 dark:text-green-400">
            ✓ תורגמו {translateDone} שאלות
          </span>
        )}
        {regenDone !== null && (
          <span className="text-xs text-purple-700 dark:text-purple-400">
            ✓ נוספו לתור {regenDone.enqueued} שאלות{regenDone.skipped > 0 ? ` (${regenDone.skipped} דולגו — כבר בתור)` : ""}
          </span>
        )}
      </div>

      {/* Batch action bar */}
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 rounded border bg-card shadow-md px-4 py-3 mb-3">
          <span className="text-sm font-medium">{selected.size} שאלות נבחרו</span>
          <button
            onClick={() => { setPanel("source"); }}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            disabled={pending}
          >
            עדכן מקור / שנה
          </button>
          <button
            onClick={() => setPanel("translate")}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={pending}
          >
            תרגם חסר (EN)
          </button>
          <button
            onClick={() => setPanel("regenerate")}
            className="rounded bg-purple-600 px-3 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
            disabled={pending}
          >
            חולל מחדש
          </button>
          <button
            onClick={() => setPanel("disable")}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
            disabled={pending}
          >
            השבת
          </button>
          <button
            onClick={() => setPanel("enable")}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            disabled={pending}
          >
            הפעל
          </button>
          <button
            onClick={() => setPanel("delete")}
            className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            disabled={pending}
          >
            מחק
          </button>
          <button
            onClick={() => { setSelected(new Set()); setPanel(null); }}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            בטל בחירה
          </button>
        </div>
      )}

      {/* Source edit panel */}
      {panel === "source" && (
        <div className="mb-3 rounded border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold">עדכן מקור עבור {selected.size} שאלות</h3>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="min-w-[16rem]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">מוסד</label>
              <SearchableSelect
                value={institution}
                onChange={(v) => setInstitution(v)}
                options={QUESTION_SOURCES}
                clearable
                clearLabel="— ללא מוסד —"
                placeholder="— ללא מוסד —"
                searchPlaceholder="חיפוש מוסד..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">שנה</label>
              <input
                type="number"
                min={1990}
                max={2030}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-24 rounded border p-1.5 text-sm bg-background text-foreground"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">קבוצה (אופציונלי)</label>
              <GroupCombobox
                value={suffix}
                onChange={setSuffix}
                className="w-44"
              />
            </div>
            <button
              onClick={handleUpdateSource}
              disabled={pending || (!institution && !year)}
              className="rounded bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {pending ? "מעדכן..." : "שמור"}
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Translate missing confirmation panel */}
      {panel === "translate" && (
        <div className="mb-3 rounded border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 p-4 space-y-3">
          <p className="text-sm text-indigo-800 dark:text-indigo-300">
            תתורגמנה שדות EN חסרים עבור <strong>{selected.size}</strong> שאלות.
            שדות שכבר תורגמו לא ייגעו. פעולה זו עשויה לקחת מספר שניות.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleTranslateMissing}
              disabled={pending}
              className="rounded bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {pending ? "מתרגם..." : "המשך"}
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Regenerate confirmation panel */}
      {panel === "regenerate" && (
        <div className="mb-3 rounded border border-purple-300 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 space-y-3">
          <p className="text-sm text-purple-800 dark:text-purple-300">
            לחולל מחדש תשובות עבור <strong>{selected.size}</strong> שאלות? משימות יתווספו לתור. שאלות עם משימה פתוחה קיימת ידולגו.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleRegenerate}
              disabled={pending}
              className="rounded bg-purple-600 px-4 py-1.5 text-sm text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {pending ? "מוסיף לתור..." : "כן, חולל מחדש"}
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Disable confirmation panel */}
      {panel === "disable" && (
        <div className="mb-3 rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            להשבית <strong>{selected.size}</strong> שאלות? הן לא יוצגו למשתמשים אך יישמרו במערכת.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleSetDisabled(true)}
              disabled={pending}
              className="rounded bg-amber-600 px-4 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {pending ? "משבית..." : "כן, השבת"}
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Enable confirmation panel */}
      {panel === "enable" && (
        <div className="mb-3 rounded border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 p-4 space-y-3">
          <p className="text-sm text-emerald-800 dark:text-emerald-300">
            להפעיל <strong>{selected.size}</strong> שאלות מחדש?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleSetDisabled(false)}
              disabled={pending}
              className="rounded bg-emerald-600 px-4 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {pending ? "מפעיל..." : "כן, הפעל"}
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation panel */}
      {panel === "delete" && (
        <div className="mb-3 rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
          <p className="text-sm text-red-800 dark:text-red-300">
            האם למחוק <strong>{selected.size}</strong> שאלות? פעולה זו אינה הפיכה.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={pending}
              className="rounded bg-red-600 px-4 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "מוחק..." : "כן, מחק"}
            </button>
            <button
              onClick={() => setPanel(null)}
              className="rounded border px-4 py-1.5 text-sm hover:bg-muted"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Questions table */}
      {questions.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">לא נמצאו שאלות התואמות את הסינון.</p>
      ) : (
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="w-10 p-2 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="cursor-pointer"
                />
              </th>
              <SortHeader field="id" label="#" className="w-10" />
              <SortHeader field="stem" label="גוף השאלה" />
              <SortHeader field="source" label="מקור" />
              <SortHeader field="chapter" label="פרק" align="center" />
              <th className="p-2 text-center text-muted-foreground whitespace-nowrap">תשובה נכונה</th>
              <SortHeader field="hasExplanation" label="הסבר" align="center" />
              <SortHeader field="confidence" label="ביטחון" align="center" />
              <SortHeader field="escalated" label="Escalated" align="center" />
              <SortHeader field="insufficientEvidence" label="ראיות חסרות" align="center" />
              <th className="p-2 text-center text-muted-foreground whitespace-nowrap">רמז</th>
              <SortHeader field="translationCount" label="תרגום EN" align="center" />
              <SortHeader field="attemptCount" label="ניסיונות" align="center" />
              <SortHeader field="percentCorrect" label="% נכונות" align="center" />
              <SortHeader field="createdAt" label="תאריך הוספה" />
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr
                key={q.id}
                className={`border-b transition-colors ${selected.has(q.id) ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-muted/30"}`}
              >
                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={selected.has(q.id)}
                    onChange={() => toggle(q.id)}
                    className="cursor-pointer"
                  />
                </td>
                <td className="p-2 text-muted-foreground font-mono">{q.id}</td>
                <td className="p-2 max-w-md">
                  <div className="flex items-start gap-2">
                    <Link
                      href={`/history/${q.id}`}
                      className={`text-primary hover:underline line-clamp-2 ${q.disabled ? "opacity-60" : ""}`}
                    >
                      {q.stem.slice(0, 120)}{q.stem.length > 120 ? "…" : ""}
                    </Link>
                    {q.disabled ? (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                        מושבתת
                      </span>
                    ) : null}
                    {q.acceptedAnswersCount > 0 ? (
                      <span
                        className="shrink-0 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200"
                        title="לשאלה זו מוגדרות מספר תשובות נכונות"
                      >
                        תשובות מרובות
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="p-2 text-muted-foreground whitespace-nowrap">
                  {q.source ?? <span className="italic text-muted-foreground/50">—</span>}
                </td>
                <td className="p-2 text-center text-muted-foreground">{q.chapterNumber}</td>
                <td className="p-2 text-center whitespace-nowrap">
                  {q.correctAnswer === null ? (
                    <span className="italic text-muted-foreground/50">—</span>
                  ) : (
                    <span className="text-xs rounded px-2 py-0.5 font-mono font-medium bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300">
                      {q.correctAnswer}
                      {q.acceptedAnswersCount > 0 ? "+" : ""}
                    </span>
                  )}
                </td>
                <td className="p-2 text-center">
                  <span
                    className={`text-xs rounded px-2 py-0.5 ${
                      q.hasExplanation
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {q.hasExplanation ? "יש" : "אין"}
                  </span>
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  {q.confidence === null ? (
                    <span className="italic text-muted-foreground/50">—</span>
                  ) : (() => {
                    const pct = Math.round(q.confidence * 100);
                    const cls =
                      pct >= 70
                        ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                        : pct >= 50
                          ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                          : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300";
                    return <span className={`text-xs rounded px-2 py-0.5 font-mono ${cls}`}>{pct}%</span>;
                  })()}
                </td>
                <td className="p-2 text-center">
                  {q.escalated === null ? (
                    <span className="italic text-muted-foreground/50">—</span>
                  ) : q.escalated ? (
                    <span className="text-xs rounded px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
                      כן
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">לא</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  {q.insufficientEvidence === null ? (
                    <span className="italic text-muted-foreground/50">—</span>
                  ) : q.insufficientEvidence ? (
                    <span className="text-xs rounded px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                      כן
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">לא</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  {q.generationHint ? (
                    <span
                      className="text-xs rounded px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                      title={q.generationHint}
                    >
                      כן
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60">לא</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  {(() => {
                    const maxFields = q.hasExplanation ? 7 : 5;
                    const full = q.translationCount >= maxFields;
                    return (
                      <span
                        className={`text-xs rounded px-2 py-0.5 ${
                          full
                            ? "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300"
                            : q.translationCount > 0
                              ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                              : "bg-muted text-muted-foreground"
                        }`}
                        title={`${q.translationCount}/${maxFields} שדות מתורגמים`}
                      >
                        {full ? "✓ מלא" : q.translationCount > 0 ? `חלקי (${q.translationCount}/${maxFields})` : "—"}
                      </span>
                    );
                  })()}
                </td>
                <td className="p-2 text-center text-muted-foreground font-mono whitespace-nowrap">
                  {q.attemptCount === 0 ? <span className="italic text-muted-foreground/50">—</span> : q.attemptCount}
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  {q.percentCorrect === null ? (
                    <span className="italic text-muted-foreground/50">—</span>
                  ) : (
                    <span
                      className={`text-xs rounded px-2 py-0.5 font-mono ${
                        q.percentCorrect >= 70
                          ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                          : q.percentCorrect >= 50
                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                            : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                      }`}
                      title={`${q.correctCount} מתוך ${q.attemptCount}`}
                    >
                      {q.percentCorrect}%
                    </span>
                  )}
                </td>
                <td className="p-2 text-muted-foreground whitespace-nowrap">
                  {DATE_FORMATTER.format(new Date(q.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
