"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

// Client-side filter for the bookmarks page. The lists are server-rendered, so
// instead of lifting all data into the client we tag each item with
// `data-search-text` and toggle visibility here. Each tab wraps its list in a
// `data-search-group` element that also holds a `data-search-empty` placeholder
// shown when the active query hides every item in that group.
export function BookmarksSearch({
  placeholder,
  rtl,
  children,
}: {
  placeholder: string;
  rtl: boolean;
  children: React.ReactNode;
}) {
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const q = query.trim().toLowerCase();

    root.querySelectorAll<HTMLElement>("[data-search-text]").forEach((el) => {
      const text = el.getAttribute("data-search-text")?.toLowerCase() ?? "";
      el.hidden = q !== "" && !text.includes(q);
    });

    root.querySelectorAll<HTMLElement>("[data-search-group]").forEach((group) => {
      const items = group.querySelectorAll<HTMLElement>("[data-search-text]");
      const visible = Array.from(items).some((el) => !el.hidden);
      const empty = group.querySelector<HTMLElement>("[data-search-empty]");
      if (empty) empty.hidden = !(q !== "" && items.length > 0 && !visible);
    });
  }, [query, children]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search
          className={`pointer-events-none absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground ${
            rtl ? "right-3" : "left-3"
          }`}
        />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          dir="auto"
          className={rtl ? "pr-9 pl-8" : "pl-9 pr-8"}
        />
        {query && (
          <button
            type="button"
            aria-label="clear"
            onClick={() => setQuery("")}
            className={`absolute top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground ${
              rtl ? "left-2" : "right-2"
            }`}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div ref={rootRef}>{children}</div>
    </div>
  );
}
