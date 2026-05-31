"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";

type Chapter = { number: number; title: string };
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";

export function HistoryFilters({ chapters }: { chapters: Chapter[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string" && v.trim()) sp.set(k, v.trim());
    }
    router.push(`/history?${sp.toString()}`);
  }

  function reset() {
    formRef.current?.reset();
    router.push("/history");
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded border bg-card p-4"
    >
      <div className="flex-1 min-w-48">
        <label className="block text-xs font-medium text-muted-foreground mb-1">חיפוש בשאלה</label>
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="טקסט מתוך השאלה..."
          className="w-full rounded border p-2 text-sm bg-background text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="min-w-[14rem]">
        <label className="block text-xs font-medium text-muted-foreground mb-1">מוסד</label>
        <SearchableSelect
          name="source"
          defaultValue={params.get("source") ?? ""}
          options={[
            { value: NULL_SOURCE_FILTER, label: "ללא מוסד" },
            ...QUESTION_SOURCES.map((s) => ({ value: s, label: s })),
          ]}
          clearable
          clearLabel="הכל"
          placeholder="הכל"
          searchPlaceholder="חיפוש מוסד..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">שנה</label>
        <input
          name="year"
          type="number"
          min={1990}
          max={2030}
          defaultValue={params.get("year") ?? ""}
          placeholder="כולל"
          className="w-24 rounded border p-2 text-sm bg-background text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">פרק</label>
        <select
          name="chapter"
          defaultValue={params.get("chapter") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">כל הפרקים</option>
          {chapters.map((c) => (
            <option key={c.number} value={c.number}>{c.number} — {c.title}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">תוצאה אחרונה</label>
        <select
          name="result"
          defaultValue={params.get("result") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="correct">נכון</option>
          <option value="wrong">שגוי</option>
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="rounded bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-4 py-2 text-sm font-medium"
        >
          חיפוש
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded border px-4 py-2 text-sm hover:bg-muted"
        >
          נקה
        </button>
      </div>
    </form>
  );
}
