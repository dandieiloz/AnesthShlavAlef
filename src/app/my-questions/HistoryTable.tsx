"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bookmark } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
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
type T = Dictionary["myQuestions"];

const STEM_PREVIEW_CHARS = 140;

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

function ResultChip({ r, t }: { r: HistoryRow; t: T }) {
  if (r.lastCorrect === null) return <span className="italic text-muted-foreground/50">—</span>;
  return r.lastCorrect ? (
    <span className="rounded px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
      {t.resultCorrect} ({r.lastChoice})
    </span>
  ) : (
    <span className="rounded px-2 py-0.5 text-xs bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300">
      {t.resultWrong} ({r.lastChoice})
    </span>
  );
}

export function HistoryTable({
  rows,
  sort,
  order,
  t,
  locale,
}: {
  rows: HistoryRow[];
  sort: SortField;
  order: SortOrder;
  t: T;
  locale: Locale;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [resetDone, setResetDone] = useState<number | null>(null);

  const dateFormatter = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Jerusalem",
  });
  const shortDate = new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
    dateStyle: "short",
    timeZone: "Asia/Jerusalem",
  });

  const allIds = rows.map((r) => r.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
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
    const msg = ids.length === 1 ? t.confirmResetOne : t.confirmResetMany.replace("{n}", String(ids.length));
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
    const nextOrder = sort === field ? (order === "asc" ? "desc" : "asc") : DEFAULT_SORT_ORDER[field];
    nextParams.set("sort", field);
    nextParams.set("order", nextOrder);
    return `${pathname}?${nextParams.toString()}`;
  }

  function SortHeader({
    field,
    label,
    align = "start",
  }: {
    field: SortField;
    label: string;
    align?: "start" | "center";
  }) {
    const indicator = sort !== field ? "" : order === "asc" ? " ▲" : " ▼";
    return (
      <th className={`whitespace-nowrap p-2 text-muted-foreground ${align === "center" ? "text-center" : "text-start"}`}>
        <Link href={sortHref(field)} className="inline-flex items-center gap-1 hover:text-foreground">
          <span>{label}</span>
          <span aria-hidden="true">{indicator}</span>
        </Link>
      </th>
    );
  }

  return (
    <div className="relative">
      {selected.size > 0 && (
        <div className="sticky top-16 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-md">
          <span className="text-sm font-medium">{t.selected.replace("{n}", String(selected.size))}</span>
          <button
            onClick={handleReset}
            disabled={pending}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {t.markUnseen}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            disabled={pending}
            className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
          >
            {t.clearSelection}
          </button>
        </div>
      )}
      {resetDone !== null && selected.size === 0 && (
        <div className="mb-2 text-xs text-emerald-700 dark:text-emerald-400">
          {t.resetDone.replace("{n}", String(resetDone))}
        </div>
      )}

      {/* Phones: compact list */}
      <ul className="divide-y rounded-lg border bg-card sm:hidden">
        {rows.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">{t.noMatches}</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/history/${r.id}`} className="block space-y-2 p-3 hover:bg-muted/30">
              <p className="line-clamp-3 text-sm leading-relaxed">
                {r.bookmarked && (
                  <Bookmark className="me-1 inline h-3.5 w-3.5 fill-amber-500 text-amber-500" aria-label={t.bookmarked} />
                )}
                {r.stem}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <ResultChip r={r} t={t} />
                <span title={r.chapterTitle}>
                  {t.colChapter} {r.chapterNumber}
                </span>
                {r.lastSeenAt && <span>{shortDate.format(new Date(r.lastSeenAt))}</span>}
                {r.attempts > 1 && <span>{t.attemptsShort.replace("{n}", String(r.attempts))}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* Tablet and up: full table */}
      <div className="hidden overflow-x-auto rounded-lg border bg-card sm:block">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-sm">
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
                <input type="checkbox" aria-label={t.selectAll} checked={allSelected} onChange={toggleAll} />
              </th>
              <SortHeader field="stem" label={t.colQuestion} />
              <SortHeader field="chapter" label={t.colChapter} align="center" />
              <SortHeader field="source" label={t.colSource} />
              <SortHeader field="attempts" label={t.colAttempts} align="center" />
              <SortHeader field="communityPercent" label={t.colCommunity} align="center" />
              <SortHeader field="lastSeen" label={t.colLastSeen} align="center" />
              <SortHeader field="lastResult" label={t.colLastResult} align="center" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">{t.noMatches}</td>
              </tr>
            )}
            {rows.map((r) => {
              const isSelected = selected.has(r.id);
              return (
                <tr key={r.id} className={`border-b last:border-b-0 hover:bg-muted/30 ${isSelected ? "bg-muted/40" : ""}`}>
                  <td className="p-2 text-center align-top">
                    <input
                      type="checkbox"
                      aria-label={t.selectRow.replace("{id}", String(r.id))}
                      checked={isSelected}
                      onChange={() => toggle(r.id)}
                    />
                  </td>
                  <td className="p-2 align-top">
                    <div className="flex items-start gap-2">
                      {r.bookmarked && (
                        <Bookmark className="mt-0.5 h-4 w-4 shrink-0 fill-amber-500 text-amber-500" aria-label={t.bookmarked} />
                      )}
                      <Link href={`/history/${r.id}`} className="break-words text-foreground hover:underline">
                        {truncate(r.stem, STEM_PREVIEW_CHARS)}
                      </Link>
                    </div>
                  </td>
                  <td className="p-2 text-center font-mono text-muted-foreground" title={r.chapterTitle}>
                    {r.chapterNumber}
                  </td>
                  <td className="truncate p-2 text-muted-foreground" title={r.source ?? undefined}>
                    {r.source ?? "—"}
                  </td>
                  <td className="p-2 text-center font-mono">{r.attempts}</td>
                  <td className="whitespace-nowrap p-2 text-center">
                    {r.communityPercentCorrect === null ? (
                      <span className="italic text-muted-foreground/50">—</span>
                    ) : (
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-xs ${
                          r.communityPercentCorrect >= 70
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : r.communityPercentCorrect >= 50
                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
                              : "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300"
                        }`}
                        title={t.communityTitle.replace("{pct}", String(r.communityPercentCorrect))}
                      >
                        {r.communityCorrect}/{r.communityAttempts}
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-2 text-center text-muted-foreground">
                    {r.lastSeenAt ? dateFormatter.format(new Date(r.lastSeenAt)) : "—"}
                  </td>
                  <td className="whitespace-nowrap p-2 text-center">
                    <ResultChip r={r} t={t} />
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
