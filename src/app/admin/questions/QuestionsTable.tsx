"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { batchUpdateSourceAction, batchDeleteQuestionsAction } from "./actions";

export type QuestionRow = {
  id: number;
  stem: string;
  source: string | null;
  chapterNumber: number;
  hasExplanation: boolean;
};

export function QuestionsTable({ questions }: { questions: QuestionRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [panel, setPanel] = useState<"source" | "delete" | null>(null);

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

  return (
    <div className="relative">
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
              <th className="p-2 text-start w-10 text-muted-foreground">#</th>
              <th className="p-2 text-start text-muted-foreground">גוף השאלה</th>
              <th className="p-2 text-start text-muted-foreground whitespace-nowrap">מקור</th>
              <th className="p-2 text-center text-muted-foreground whitespace-nowrap">פרק</th>
              <th className="p-2 text-center text-muted-foreground whitespace-nowrap">הסבר</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
