"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setDemoSourceAllowedAction,
  setDemoSourcesAllowedBulkAction,
} from "./actions";

export type SourceGroup = "official" | "hospital" | "other";

export type SourceRow = {
  source: string;
  label: string;
  allowed: boolean;
  questionCount: number;
  group: SourceGroup;
};

type SortKey = "name" | "count-desc" | "count-asc" | "allowed-first";
type FilterKey = "all" | "allowed" | "disallowed" | "with-questions" | "empty";

const GROUP_META: Record<SourceGroup, { title: string; order: number }> = {
  official: { title: "מבחנים רשמיים", order: 0 },
  hospital: { title: "בתי חולים", order: 1 },
  other: { title: "אחר", order: 2 },
};

const collator = new Intl.Collator("he", { sensitivity: "base" });

export function DemoPlanClient({ rows }: { rows: SourceRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [collapsed, setCollapsed] = useState<Record<SourceGroup, boolean>>({
    official: false,
    hospital: false,
    other: false,
  });

  function toggle(source: string, allowed: boolean) {
    startTransition(async () => {
      await setDemoSourceAllowedAction(source, allowed);
      router.refresh();
    });
  }

  function bulk(sources: string[], allowed: boolean) {
    if (sources.length === 0) return;
    startTransition(async () => {
      await setDemoSourcesAllowedBulkAction(sources, allowed);
      router.refresh();
    });
  }

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter(
        (r) =>
          r.label.toLowerCase().includes(q) ||
          r.source.toLowerCase().includes(q),
      );
    }
    switch (filter) {
      case "allowed":
        list = list.filter((r) => r.allowed);
        break;
      case "disallowed":
        list = list.filter((r) => !r.allowed);
        break;
      case "with-questions":
        list = list.filter((r) => r.questionCount > 0);
        break;
      case "empty":
        list = list.filter((r) => r.questionCount === 0);
        break;
    }
    const cmp = (a: SourceRow, b: SourceRow) => {
      switch (sort) {
        case "count-desc":
          return b.questionCount - a.questionCount || collator.compare(a.label, b.label);
        case "count-asc":
          return a.questionCount - b.questionCount || collator.compare(a.label, b.label);
        case "allowed-first":
          return (
            Number(b.allowed) - Number(a.allowed) ||
            b.questionCount - a.questionCount ||
            collator.compare(a.label, b.label)
          );
        case "name":
        default:
          return collator.compare(a.label, b.label);
      }
    };
    return [...list].sort(cmp);
  }, [rows, query, sort, filter]);

  const grouped = useMemo(() => {
    const map = new Map<SourceGroup, SourceRow[]>();
    for (const r of filteredSorted) {
      const arr = map.get(r.group) ?? [];
      arr.push(r);
      map.set(r.group, arr);
    }
    return [...map.entries()].sort(
      ([a], [b]) => GROUP_META[a].order - GROUP_META[b].order,
    );
  }, [filteredSorted]);

  const totalShown = filteredSorted.length;
  const totalAllowed = rows.filter((r) => r.allowed).length;

  return (
    <div className="space-y-3">
      <div className="rounded border bg-card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[12rem]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              חיפוש
            </label>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="שם מקור..."
              className="w-full rounded border p-2 text-sm bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              סינון
            </label>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterKey)}
              className="rounded border p-2 text-sm bg-background text-foreground"
            >
              <option value="all">הכל</option>
              <option value="allowed">מאופשרים בלבד</option>
              <option value="disallowed">חסומים בלבד</option>
              <option value="with-questions">עם שאלות</option>
              <option value="empty">ללא שאלות</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              מיון
            </label>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded border p-2 text-sm bg-background text-foreground"
            >
              <option value="name">שם (א-ת)</option>
              <option value="count-desc">מספר שאלות (יורד)</option>
              <option value="count-asc">מספר שאלות (עולה)</option>
              <option value="allowed-first">מאופשרים תחילה</option>
            </select>
          </div>
          {(query || filter !== "all" || sort !== "name") && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setFilter("all");
                setSort("name");
              }}
              className="rounded border px-3 py-2 text-sm hover:bg-accent"
            >
              איפוס
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          מציג <span className="font-mono">{totalShown}</span> מתוך{" "}
          <span className="font-mono">{rows.length}</span>
          {" · "}
          <span className="font-mono">{totalAllowed}</span> מאופשרים
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="rounded border bg-card p-6 text-center text-sm text-muted-foreground">
          לא נמצאו מקורות תואמים
        </div>
      ) : (
        grouped.map(([group, groupRows]) => {
          const allowedInGroup = groupRows.filter((r) => r.allowed).length;
          const questionsInGroup = groupRows.reduce(
            (s, r) => s + r.questionCount,
            0,
          );
          const isCollapsed = collapsed[group];
          const allOn = allowedInGroup === groupRows.length;
          const allOff = allowedInGroup === 0;
          return (
            <div key={group} className="rounded border bg-card overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b p-3">
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [group]: !c[group] }))
                  }
                  className="flex items-center gap-2 text-right hover:text-foreground"
                >
                  <span
                    aria-hidden
                    className={`inline-block transition-transform ${
                      isCollapsed ? "" : "rotate-90"
                    }`}
                  >
                    ▸
                  </span>
                  <span className="font-medium">{GROUP_META[group].title}</span>
                  <span className="text-xs text-muted-foreground">
                    <span className="font-mono">{allowedInGroup}</span>
                    {"/"}
                    <span className="font-mono">{groupRows.length}</span>
                    {" · "}
                    <span className="font-mono">{questionsInGroup}</span> שאלות
                  </span>
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={pending || allOn}
                    onClick={() =>
                      bulk(
                        groupRows.filter((r) => !r.allowed).map((r) => r.source),
                        true,
                      )
                    }
                    className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    אפשר הכל
                  </button>
                  <button
                    type="button"
                    disabled={pending || allOff}
                    onClick={() =>
                      bulk(
                        groupRows.filter((r) => r.allowed).map((r) => r.source),
                        false,
                      )
                    }
                    className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
                  >
                    חסום הכל
                  </button>
                </div>
              </div>
              {!isCollapsed && (
                <ul className="divide-y">
                  {groupRows.map((r) => (
                    <li key={r.source} className="p-3">
                      <label className="flex items-center justify-between gap-3 cursor-pointer">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{r.label}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            <span className="font-mono">{r.questionCount}</span>{" "}
                            שאלות
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={r.allowed}
                          disabled={pending}
                          onChange={(e) => toggle(r.source, e.target.checked)}
                          className="h-5 w-5 accent-emerald-600"
                        />
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
