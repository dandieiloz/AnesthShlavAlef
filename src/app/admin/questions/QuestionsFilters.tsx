"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { QUESTION_SOURCES } from "@/lib/hospitals";

type Chapter = { number: number; title: string };

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
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">מוסד</label>
        <select
          name="source"
          defaultValue={params.get("source") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          {QUESTION_SOURCES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
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
