"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { HOSPITALS } from "@/lib/hospitals";

export function UsersFilters() {
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
    router.push(`/admin/users?${sp.toString()}`);
  }

  function reset() {
    formRef.current?.reset();
    router.push("/admin/users");
  }

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="flex flex-wrap items-end gap-3 rounded border bg-card p-4"
    >
      <div className="flex-1 min-w-48">
        <label className="block text-xs font-medium text-muted-foreground mb-1">חיפוש</label>
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="שם או אימייל..."
          className="w-full rounded border p-2 text-sm bg-background text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">תפקיד</label>
        <select
          name="role"
          defaultValue={params.get("role") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="USER">משתמש</option>
          <option value="ADMIN">מנהל</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">תוכנית</label>
        <select
          name="plan"
          defaultValue={params.get("plan") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="DEMO">דמו</option>
          <option value="PAID">בתשלום</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">בית חולים</label>
        <select
          name="hospital"
          defaultValue={params.get("hospital") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          {HOSPITALS.map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">פרופיל</label>
        <select
          name="profile"
          defaultValue={params.get("profile") ?? ""}
          className="rounded border p-2 text-sm bg-background text-foreground"
        >
          <option value="">הכל</option>
          <option value="complete">מלא</option>
          <option value="incomplete">חסר</option>
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
