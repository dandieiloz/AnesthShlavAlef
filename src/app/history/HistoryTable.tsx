"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";
import { resetQuestionHistoryAction } from "./actions";

export type HistoryRow = {
  id: number;
  stem: string;
  source: string | null;
  chapterNumber: number;
  chapterTitle: string;
  attempts: number;
  lastSeenAt: string | null;
  lastChoice: "A" | "B" | "C" | "D" | null;
  lastCorrect: boolean | null;
  lastQuizId: number | null;
  bookmarked: boolean;
  communityAttempts: number;
  communityCorrect: number;
  communityPercentCorrect: number | null;
};

type SortField = "stem" | "source" | "chapter" | "attempts" | "lastSeen" | "lastResult" | "communityPercent";
type SortOrder = "asc" | "desc";

const STEM_PREVIEW_CHARS = 140;
const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

const DEFAULT_SORT_ORDER: Record<SortField, SortOrder> = {
  stem: "asc",
  source: "asc",
  chapter: "asc",
  attempts: "desc",
  lastSeen: "desc",
  lastResult: "desc",
  communityPercent: "desc",
};

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function HistoryTable({
  rows,
  sort,
  order,
}: {
  rows: HistoryRow[];
  sort: SortField;
  order: SortOrder;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [resetDone, setResetDone] = useState<number | null>(null);

  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(allIds));
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleReset() {
    const ids = [...selected];
    if (ids.length === 0) return;
    const msg =
      ids.length === 1
        ? "לסמן שאלה זו כלא נראתה? כל הניסיונות שלך בשאלה זו יימחקו."
        : `לסמן ${ids.length} שאלות כלא נראו? כל הניסיונות שלך בשאלות אלו יימחקו.`;
    if (!confirm(msg)) return;
    startTransition(async () => {
      await resetQuestionHistoryAction(ids);
      setResetDone(ids.length);
      setSelected(new Set());
      router.refresh();
    });
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

  // Suppress unused warning while still allowing future row click navigation.
  void router;

  return (
    <div className="relative">
      {selected.size > 0 && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded border bg-card shadow-md px-4 py-3">
          <span className="text-sm font-medium">{selected.size} נבחרו</span>
          <button
            onClick={handleReset}
            disabled={pending}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            סמן כלא נראו
          </button>
          <button
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            בטל בחירה
          </button>
        </div>
      )}
      {resetDone !== null && selected.size === 0 && (
        <div className="mb-2 text-xs text-emerald-700 dark:text-emerald-400">
          ✓ נראו ההיסטוריה של {resetDone} שאלות
        </div>
      )}
      <div className="overflow-x-auto rounded border bg-card">
      <table className="w-full min-w-[860px] text-sm border-collapse table-fixed">
        <colgroup>
          <col className="w-10" />
          <col />
          <col className="w-16" />
          <col className="w-32" />
          <col className="w-20" />
          <col className="w-24" />
          <col className="w-36" />
          <col className="w-32" />
        </colgroup>
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="p-2 text-center">
              <input
                type="checkbox"
                aria-label="בחר הכל"
                checked={allSelected}
                onChange={toggleAll}
              />
            </th>
            <SortHeader field="stem" label="שאלה" />
            <SortHeader field="chapter" label="פרק" align="center" />
            <SortHeader field="source" label="מקור" />
            <SortHeader field="attempts" label="ניסיונות" align="center" />
            <SortHeader field="communityPercent" label="שאר המשתמשים" align="center" />
            <SortHeader field="lastSeen" label="נצפה לאחרונה" align="center" />
            <SortHeader field="lastResult" label="תוצאה אחרונה" align="center" />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="p-6 text-center text-muted-foreground">
                לא נמצאו שאלות התואמות את הסינון.
              </td>
            </tr>
          )}
          {rows.map((r) => {
            const stemNode = truncate(r.stem, STEM_PREVIEW_CHARS);
            const isSelected = selected.has(r.id);
            return (
              <tr
                key={r.id}
                className={`border-b last:border-b-0 hover:bg-muted/30 ${isSelected ? "bg-muted/40" : ""}`}
              >
                <td className="p-2 text-center align-top">
                  <input
                    type="checkbox"
                    aria-label={`בחר שאלה ${r.id}`}
                    checked={isSelected}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td className="p-2 align-top">
                  <div className="flex items-start gap-2">
                    {r.bookmarked && (
                      <Bookmark
                        className="mt-0.5 h-4 w-4 shrink-0 fill-amber-500 text-amber-500"
                        aria-label="שאלה מסומנת"
                      />
                    )}
                    <Link
                      href={`/history/${r.id}`}
                      className="hover:underline text-foreground break-words"
                    >
                      {stemNode}
                    </Link>
                  </div>
                </td>
                <td
                  className="p-2 text-center font-mono text-muted-foreground"
                  title={r.chapterTitle}
                >
                  {r.chapterNumber}
                </td>
                <td className="p-2 truncate text-muted-foreground" title={r.source ?? undefined}>
                  {r.source ?? "—"}
                </td>
                <td className="p-2 text-center font-mono">{r.attempts}</td>
                <td className="p-2 text-center whitespace-nowrap">
                  {r.communityPercentCorrect === null ? (
                    <span className="italic text-muted-foreground/50">—</span>
                  ) : (
                    <span
                      className={`text-xs rounded px-2 py-0.5 font-mono ${
                        r.communityPercentCorrect >= 70
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                          : r.communityPercentCorrect >= 50
                            ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                            : "bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300"
                      }`}
                      title={`${r.communityPercentCorrect}% הצליחו מתוך שאר המשתמשים`}
                    >
                      {r.communityCorrect}/{r.communityAttempts}
                    </span>
                  )}
                </td>
                <td className="p-2 text-center whitespace-nowrap text-muted-foreground">
                  {r.lastSeenAt ? DATE_FORMATTER.format(new Date(r.lastSeenAt)) : "—"}
                </td>
                <td className="p-2 text-center whitespace-nowrap">
                  {r.lastCorrect === null ? (
                    <span className="italic text-muted-foreground/50">—</span>
                  ) : r.lastCorrect ? (
                    <span className="text-xs rounded px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                      ✓ נכון ({r.lastChoice})
                    </span>
                  ) : (
                    <span className="text-xs rounded px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300">
                      ✗ שגוי ({r.lastChoice})
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
