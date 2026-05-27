"use client";
import { useState, useMemo, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { usefulnessTone, TONE_ROW_CLASS, TONE_DOT_CLASS, toneLabel } from "@/lib/usefulness";
import type { UsefulnessTone } from "@/lib/usefulness";
import { Search, CheckSquare, Square } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

type StudyNewT = Dictionary["studyNew"];

interface ChapterRow {
  id: number;
  number: number;
  title: string;
  learningUsefulnessIndex: number | null;
  questionCount: number;
}

const ALL_TONES: UsefulnessTone[] = ["very-high", "high", "medium", "low", "unrated"];

const TONE_CHIP_CLASS: Record<UsefulnessTone, string> = {
  "very-high": "border-rose-400 bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100",
  high:        "border-amber-400 bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100",
  medium:      "border-emerald-400 bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100",
  low:         "border-sky-400 bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100",
  unrated:     "border-border bg-muted text-muted-foreground",
};

export function ChapterPicker({
  chapters,
  preselected = [],
  onSelectedChaptersChange,
  locale,
  t,
}: {
  chapters: ChapterRow[];
  preselected?: number[];
  onSelectedChaptersChange?: (chapters: ChapterRow[]) => void;
  locale: Locale;
  t: StudyNewT;
}) {
  const [query, setQuery] = useState("");
  const [toneFilter, setToneFilter] = useState<Set<UsefulnessTone>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set(preselected));

  useEffect(() => {
    if (!onSelectedChaptersChange) return;
    onSelectedChaptersChange(chapters.filter((c) => selected.has(c.id)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chapters.filter((c) => {
      if (c.questionCount === 0) return false;
      if (toneFilter.size > 0 && !toneFilter.has(usefulnessTone(c.learningUsefulnessIndex))) return false;
      if (q) {
        const num = String(c.number);
        if (!num.includes(q) && !c.title.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [chapters, query, toneFilter]);

  function toggleTone(tone: UsefulnessTone) {
    setToneFilter((prev) => {
      const next = new Set(prev);
      next.has(tone) ? next.delete(tone) : next.add(tone);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((c) => next.add(c.id));
      return next;
    });
  }

  function clearVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      visible.forEach((c) => next.delete(c.id));
      return next;
    });
  }

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const selectedCount = selected.size;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder={t.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pe-9"
          dir={locale === "he" ? "rtl" : "ltr"}
        />
      </div>

      {/* Usefulness filter chips */}
      <div className="flex flex-wrap gap-1.5">
        {ALL_TONES.map((tone) => (
          <button
            key={tone}
            type="button"
            onClick={() => toggleTone(tone)}
            className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity ${TONE_CHIP_CLASS[tone]} ${
              toneFilter.size > 0 && !toneFilter.has(tone) ? "opacity-35" : "opacity-100"
            }`}
          >
            {toneLabel(tone, locale)}
          </button>
        ))}
      </div>

      {/* Bulk actions + counter */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex gap-2">
          <button type="button" onClick={selectAllVisible} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <CheckSquare className="h-3.5 w-3.5" />
            {t.selectAll}
          </button>
          <span>·</span>
          <button type="button" onClick={clearVisible} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <Square className="h-3.5 w-3.5" />
            {t.clear}
          </button>
        </div>
        <span>
          {selectedCount > 0 ? (
            <span className="text-primary font-semibold">{t.selectedSuffix(selectedCount)}</span>
          ) : (
            t.noneSelected
          )}
          {" "}&middot; {t.shownChaptersSuffix(visible.length)}
        </span>
      </div>

      {/* Chapter list */}
      <div className="max-h-96 overflow-y-auto rounded-lg border divide-y divide-border">
        {visible.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">{t.noChaptersFound}</p>
        ) : (
          visible.map((c) => {
            const tone = usefulnessTone(c.learningUsefulnessIndex);
            const isSelected = selected.has(c.id);
            return (
              <label
                key={c.id}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer transition-colors hover:brightness-95 dark:hover:brightness-110 ${TONE_ROW_CLASS[tone]}`}
              >
                <input
                  type="checkbox"
                  name="chapterIds"
                  value={c.id}
                  checked={isSelected}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4 rounded border-input accent-primary"
                />
                <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT_CLASS[tone]}`} />
                <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">{c.number}</span>
                <span className="flex-1 font-medium">{c.title}</span>
                <Badge variant="secondary" className="shrink-0 text-xs">{c.questionCount}</Badge>
              </label>
            );
          })
        )}
      </div>

      {/* Hidden inputs for controlled selected state — name="chapterIds" already on checkboxes.
          Nothing extra needed; the checked state feeds the form directly. */}
    </div>
  );
}
