"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";

export type ChapterOption = {
  id: number;
  number: number;
  title: string;
};

export function AttemptsFilters({
  userId,
  chapters,
}: {
  userId: string;
  chapters: ChapterOption[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const basePath = `/admin/users/${userId}/attempts`;

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const sp = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (typeof v === "string" && v.trim()) sp.set(k, v.trim());
    }
    router.push(`${basePath}?${sp.toString()}`);
  }

  function reset() {
    formRef.current?.reset();
    router.push(basePath);
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

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">פרק</label>
        <select
          name="chapter"
          defaultValue={params.get("chapter") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">כל הפרקים</option>
          {chapters.map((c) => (
            <option key={c.id} value={String(c.number)}>
              {c.number}. {c.title}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">תוצאה</label>
        <select
          name="correct"
          defaultValue={params.get("correct") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="yes">נכון בלבד</option>
          <option value="no">שגוי בלבד</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">מיון</label>
        <select
          name="sort"
          defaultValue={params.get("sort") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">לפי זמן – חדש לישן</option>
          <option value="oldest">לפי זמן – ישן לחדש</option>
          <option value="chapter">לפי פרק</option>
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
