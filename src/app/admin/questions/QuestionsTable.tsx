"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { batchUpdateSourceAction, batchDeleteQuestionsAction, batchTranslateMissingAction } from "./actions";

export type QuestionRow = {
  id: number;
  stem: string;
  source: string | null;
  createdAt: string;
  chapterNumber: number;
  hasExplanation: boolean;
  /** Number of EN translation fields already cached (question + answer combined) */
  translationCount: number;
};

type SortField = "id" | "stem" | "source" | "chapter" | "hasExplanation" | "translationCount" | "createdAt";
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
  translationCount: "desc",
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
  const [panel, setPanel] = useState<"source" | "delete" | "translate" | null>(null);
  const [translateDone, setTranslateDone] = useState<number | null>(null);

  // Source edit form state
  const [institution, setInstitution] = useState("");
  const [year, setYear] = useState("");

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
        ? `${institution} ${year}`
        : institution || year || null;
    startTransition(async () => {
      await batchUpdateSourceAction([...selected], source);
      setSelected(new Set());
      setPanel(null);
      setInstitution("");
      setYear("");
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
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">מוסד</label>
              <select
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="rounded border p-1.5 text-sm bg-background text-foreground"
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
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-24 rounded border p-1.5 text-sm bg-background text-foreground"
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
              <SortHeader field="hasExplanation" label="הסבר" align="center" />
              <SortHeader field="translationCount" label="תרגום EN" align="center" />
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
                  <Link
                    href={`/admin/questions/${q.id}`}
                    className="text-primary hover:underline line-clamp-2"
                  >
                    {q.stem.slice(0, 120)}{q.stem.length > 120 ? "…" : ""}
                  </Link>
                </td>
                <td className="p-2 text-muted-foreground whitespace-nowrap">
                  {q.source ?? <span className="italic text-muted-foreground/50">—</span>}
                </td>
                <td className="p-2 text-center text-muted-foreground">{q.chapterNumber}</td>
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
