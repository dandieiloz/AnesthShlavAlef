"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ArrowDownUp } from "lucide-react";

export type BookmarksSortValue = "newest" | "oldest" | "chapter";

export function BookmarksSort({
  value,
  rtl,
  labels,
}: {
  value: BookmarksSortValue;
  rtl: boolean;
  labels: { sortLabel: string; newest: string; oldest: string; chapter: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "newest") params.delete("sort");
    else params.set("sort", next);
    const qs = params.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground" dir={rtl ? "rtl" : "ltr"}>
      <ArrowDownUp className="h-4 w-4 shrink-0" />
      <span className="sr-only">{labels.sortLabel}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="newest">{labels.newest}</option>
        <option value="oldest">{labels.oldest}</option>
        <option value="chapter">{labels.chapter}</option>
      </select>
    </label>
  );
}
