"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { Dictionary } from "@/lib/i18n";

type Chapter = { number: number; title: string };
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";

export function HistoryFilters({
  chapters,
  isAdmin = false,
  tab,
  showResultFilter = true,
  t,
}: {
  chapters: Chapter[];
  isAdmin?: boolean;
  tab: "all" | "wrong";
  showResultFilter?: boolean;
  t: Dictionary["myQuestions"];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  // Phones show only the search box until the user opens the other filters.
  const activeExtra = ["source", "year", "chapter", "result", "all"].filter((k) => params.get(k)).length;
  const [showExtra, setShowExtra] = useState(activeExtra > 0);
  const extra = showExtra ? "" : "hidden sm:block";

  function hrefFor(sp: URLSearchParams) {
    if (tab !== "all") sp.set("tab", tab);
    const qs = sp.toString();
    return qs ? `/my-questions?${qs}` : "/my-questions";
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string" && v.trim()) sp.set(k, v.trim());
    }
    router.push(hrefFor(sp));
  }

  function reset() {
    formRef.current?.reset();
    router.push(hrefFor(new URLSearchParams()));
  }

  const inputClass = "rounded-md border p-2 text-sm bg-background text-foreground placeholder:text-muted-foreground";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="grid grid-cols-2 items-end gap-3 rounded-lg border bg-card p-3 sm:flex sm:flex-wrap sm:p-4"
    >
      <div className="col-span-2 sm:min-w-48 sm:flex-1">
        <label className={labelClass}>{t.searchLabel}</label>
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder={t.searchPlaceholder}
          className={`w-full ${inputClass}`}
        />
      </div>

      <div className={`col-span-2 sm:min-w-[14rem] ${extra}`}>
        <label className={labelClass}>{t.sourceLabel}</label>
        <SearchableSelect
          name="source"
          defaultValue={params.get("source") ?? ""}
          options={[
            { value: NULL_SOURCE_FILTER, label: t.noSource },
            ...QUESTION_SOURCES.map((s) => ({ value: s, label: s })),
          ]}
          clearable
          clearLabel={t.all}
          placeholder={t.all}
          searchPlaceholder={t.searchSource}
        />
      </div>

      <div className={extra}>
        <label className={labelClass}>{t.yearLabel}</label>
        <input
          name="year"
          type="number"
          min={1990}
          max={2030}
          defaultValue={params.get("year") ?? ""}
          placeholder={t.yearPlaceholder}
          className={`w-full sm:w-24 ${inputClass}`}
        />
      </div>

      <div className={extra}>
        <label className={labelClass}>{t.chapterLabel}</label>
        <select
          name="chapter"
          defaultValue={params.get("chapter") ?? ""}
          className={`w-full sm:w-auto sm:max-w-[16rem] ${inputClass}`}
        >
          <option value="">{t.allChapters}</option>
          {chapters.map((c) => (
            <option key={c.number} value={c.number}>{c.number} — {c.title}</option>
          ))}
        </select>
      </div>

      {showResultFilter && (
        <div className={extra}>
          <label className={labelClass}>{t.resultLabel}</label>
          <select
            name="result"
            defaultValue={params.get("result") ?? ""}
            className={`w-full sm:w-auto ${inputClass}`}
          >
            <option value="">{t.all}</option>
            <option value="correct">{t.correct}</option>
            <option value="wrong">{t.wrong}</option>
          </select>
        </div>
      )}

      <div className="col-span-2 flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          {t.search}
        </button>
        <button type="button" onClick={reset} className="rounded-md border px-4 py-2 text-sm hover:bg-muted">
          {t.clear}
        </button>
        <button
          type="button"
          onClick={() => setShowExtra((v) => !v)}
          aria-expanded={showExtra}
          className="ms-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm hover:bg-muted sm:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          {showExtra ? t.fewerFilters : t.moreFilters}
          {!showExtra && activeExtra > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{activeExtra}</span>
          )}
        </button>
      </div>

      {isAdmin && (
        <label className={`col-span-2 basis-full items-center gap-2 text-sm text-muted-foreground ${showExtra ? "flex" : "hidden sm:flex"}`}>
          <input
            type="checkbox"
            name="all"
            value="1"
            defaultChecked={params.get("all") === "1"}
            className="h-4 w-4"
          />
          <span>{t.adminShowAll}</span>
        </label>
      )}
    </form>
  );
}
