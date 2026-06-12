"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { GroupCombobox } from "@/components/GroupCombobox";

type Chapter = { number: number; title: string };
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";

export function QuestionsFilters({ chapters }: { chapters: Chapter[] }) {
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
    router.push(`/admin/questions?${sp.toString()}`);
  }

  function reset() {
    formRef.current?.reset();
    router.push("/admin/questions");
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded border bg-card p-4"
    >
      {/* Text search */}
      <div className="flex-1 min-w-48">
        <label className="block text-xs font-medium text-muted-foreground mb-1">חיפוש טקסט</label>
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="גוף השאלה..."
          className="w-full rounded border p-2 text-sm bg-background text-foreground placeholder:text-muted-foreground"
        />
      </div>

      {/* Source institution */}
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

      {/* Year */}
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

      {/* Suffix / group */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">קבוצה</label>
        <GroupCombobox
          name="suffix"
          defaultValue={params.get("suffix") ?? ""}
          placeholder="הכל"
          className="w-40"
        />
      </div>

      {/* Has explanation */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">הסבר</label>
        <select
          name="hasExplanation"
          defaultValue={params.get("hasExplanation") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="yes">יש הסבר</option>
          <option value="no">אין הסבר</option>
        </select>
      </div>

      {/* Chapter */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">פרק</label>
        <select
          name="chapter"
          defaultValue={params.get("chapter") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          {chapters.map((c) => (
            <option key={c.number} value={c.number}>{c.number} — {c.title}</option>
          ))}
        </select>
      </div>

      {/* Confidence range */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">ביטחון</label>
        <select
          name="confidence"
          defaultValue={params.get("confidence") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="lt50">{"< 50%"}</option>
          <option value="lt70">{"< 70%"}</option>
          <option value="gte70">{"≥ 70%"}</option>
        </select>
      </div>

      {/* Escalated */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">Escalated</label>
        <select
          name="escalated"
          defaultValue={params.get("escalated") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="yes">כן</option>
          <option value="no">לא</option>
        </select>
      </div>

      {/* Insufficient evidence */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">ראיות חסרות</label>
        <select
          name="insufficient"
          defaultValue={params.get("insufficient") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="yes">כן</option>
          <option value="no">לא</option>
        </select>
      </div>

      {/* Generated with hint (רמז) */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">רמז</label>
        <select
          name="hint"
          defaultValue={params.get("hint") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="yes">עם רמז</option>
          <option value="no">ללא</option>
        </select>
      </div>

      {/* Status (active / disabled) */}
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">מצב</label>
        <select
          name="status"
          defaultValue={params.get("status") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">פעילות</option>
          <option value="disabled">מושבתות</option>
          <option value="all">הכל</option>
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
