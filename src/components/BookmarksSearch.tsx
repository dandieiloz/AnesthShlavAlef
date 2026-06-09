"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";

// Client-side filter + match highlighter for the bookmarks page. The lists are
// server-rendered, so instead of lifting all data into the client we tag each
// item with `data-search-text` and toggle visibility here. Each tab wraps its
// list in a `data-search-group` element that also holds a `data-search-empty`
// placeholder shown when the active query hides every item in that group.
//
// Matching substrings inside `data-search-highlight` containers are wrapped in
// <mark> so the user can see *why* a result matched. KaTeX-rendered math is
// skipped so formulae are never corrupted.

function clearMarks(root: HTMLElement) {
  root.querySelectorAll("mark[data-search-mark]").forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(m.textContent ?? ""), m);
    parent.normalize();
  });
}

function applyMarks(root: HTMLElement, q: string) {
  root.querySelectorAll<HTMLElement>("[data-search-highlight]").forEach((container) => {
    if (container.closest("[hidden]")) return;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (node.parentElement?.closest(".katex, mark")) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });
    const textNodes: Text[] = [];
    let n = walker.nextNode();
    while (n) {
      textNodes.push(n as Text);
      n = walker.nextNode();
    }
    for (const node of textNodes) {
      const text = node.nodeValue ?? "";
      const lower = text.toLowerCase();
      let idx = lower.indexOf(q);
      if (idx === -1) continue;
      const frag = document.createDocumentFragment();
      let last = 0;
      while (idx !== -1) {
        if (idx > last) frag.appendChild(document.createTextNode(text.slice(last, idx)));
        const mark = document.createElement("mark");
        mark.setAttribute("data-search-mark", "");
        mark.className = "search-hit";
        mark.textContent = text.slice(idx, idx + q.length);
        frag.appendChild(mark);
        last = idx + q.length;
        idx = lower.indexOf(q, last);
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }
  });
}

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

    clearMarks(root);

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

    if (q !== "") applyMarks(root, q);
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
