"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { MathMarkdown } from "@/components/MathMarkdown";
import { splitSentences, hashSentence } from "@/lib/sentences";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, StickyNote, Trash2, X } from "lucide-react";
import {
  setHighlightAction,
  removeHighlightAction,
  setHighlightNoteAction,
} from "@/app/(user)/highlight-actions";

export type HighlightRecord = {
  id: number;
  section: string;
  sentenceIndex: number;
  colorId: number;
  sentenceHash: string;
  note: string | null;
};

type Props = {
  text: string;
  section: string;
  questionId: number;
  locale: "he" | "en";
  highlights: HighlightRecord[];
  t: {
    pickColor: string;
    removeHighlight: string;
    addNote: string;
    editNote: string;
    noteTitle: string;
    notePlaceholder: string;
    saveNote: string;
    clearNote: string;
    staleHighlight: string;
    colorYellow: string;
    colorGreen: string;
    colorPink: string;
    colorBlue: string;
  };
};

const COLOR_CLASSES: Record<number, string> = {
  1: "bg-yellow-200/70 dark:bg-yellow-400/25",
  2: "bg-green-200/70 dark:bg-green-400/25",
  3: "bg-pink-200/70 dark:bg-pink-400/25",
  4: "bg-blue-200/70 dark:bg-blue-400/25",
};

const COLOR_SWATCH: Record<number, string> = {
  1: "bg-yellow-300 dark:bg-yellow-400",
  2: "bg-green-300 dark:bg-green-400",
  3: "bg-pink-300 dark:bg-pink-400",
  4: "bg-blue-300 dark:bg-blue-400",
};

// Color applied when a note is saved on a sentence that has no highlight yet.
const DEFAULT_NOTE_COLOR = 1;

export function HighlightableMarkdown({
  text,
  section,
  questionId,
  locale,
  highlights,
  t,
}: Props) {
  const sentences = useMemo(() => splitSentences(text), [text]);

  // Local copy of highlights for optimistic UI. Keyed by sentenceIndex.
  const initialMap = useMemo(() => {
    const m = new Map<number, HighlightRecord>();
    for (const h of highlights) {
      if (h.section === section) m.set(h.sentenceIndex, h);
    }
    return m;
  }, [highlights, section]);

  const [state, setState] = useState<Map<number, HighlightRecord>>(initialMap);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [noteEditing, setNoteEditing] = useState<{ index: number; value: string } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [, startTransition] = useTransition();

  // Close the popover on outside click
  useEffect(() => {
    if (activeIndex === null) return;
    function onDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setActiveIndex(null);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setActiveIndex(null);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onEsc);
    };
  }, [activeIndex]);

  function applyColor(index: number, colorId: number) {
    const sentenceText = sentences[index];
    const sentenceHash = hashSentence(sentenceText);
    const prev = state.get(index);
    const next: HighlightRecord = {
      id: prev?.id ?? -1,
      section,
      sentenceIndex: index,
      colorId,
      sentenceHash,
      note: prev?.note ?? null,
    };
    const newMap = new Map(state);
    newMap.set(index, next);
    setState(newMap);
    setActiveIndex(null);
    startTransition(() => {
      setHighlightAction({
        questionId,
        locale,
        section,
        sentenceIndex: index,
        colorId,
        sentenceHash,
        sentenceText,
      });
    });
  }

  function removeHighlight(index: number) {
    const newMap = new Map(state);
    newMap.delete(index);
    setState(newMap);
    setActiveIndex(null);
    startTransition(() => {
      removeHighlightAction({ questionId, locale, section, sentenceIndex: index });
    });
  }

  function saveNote() {
    if (!noteEditing) return;
    const { index, value } = noteEditing;
    const sentenceText = sentences[index];
    const sentenceHash = hashSentence(sentenceText);
    const note = value.trim() || null;
    const prev = state.get(index);
    const newMap = new Map(state);
    // Saving a note auto-creates a default-colored highlight when none exists,
    // so the sentence shows up under "משפטים מסומנים".
    newMap.set(index, {
      id: prev?.id ?? -1,
      section,
      sentenceIndex: index,
      colorId: prev?.colorId ?? DEFAULT_NOTE_COLOR,
      sentenceHash,
      note,
    });
    setState(newMap);
    startTransition(() => {
      setHighlightNoteAction({
        questionId,
        locale,
        section,
        sentenceIndex: index,
        note: value,
        sentenceHash,
        sentenceText,
      });
    });
    setNoteEditing(null);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Each sentence is its own MathMarkdown so KaTeX + lists stay intact, while
  // the wrapping span owns the click handler + highlight color.
  return (
    <>
      <div ref={containerRef} className="answer-highlightable space-y-1 relative">
        {sentences.map((s, i) => {
          const h = state.get(i);
          const stale = h && h.sentenceHash !== hashSentence(s);
          const colorCls = h && !stale ? COLOR_CLASSES[h.colorId] : "";
          const staleCls = stale
            ? "outline-dotted outline-1 outline-amber-500/60 rounded"
            : "";
          const isActive = activeIndex === i;
          return (
            <div
              key={i}
              data-sent-id={i}
              role="button"
              tabIndex={0}
              title={stale ? t.staleHighlight : undefined}
              onClick={(e) => {
                e.stopPropagation();
                setActiveIndex(isActive ? null : i);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveIndex(isActive ? null : i);
                }
              }}
              className={`group relative cursor-pointer rounded px-1 py-0.5 transition-colors hover:ring-1 hover:ring-primary/40 ${colorCls} ${staleCls}`}
            >
              <MathMarkdown>{s}</MathMarkdown>
              {h?.note ? (
                <StickyNote
                  className="inline h-3 w-3 align-text-top text-amber-600 dark:text-amber-400 mx-0.5"
                  aria-label={t.editNote}
                />
              ) : null}
              {isActive && (
                <span
                  className={`absolute z-30 mt-1 flex items-center gap-1 rounded-md border bg-popover p-1.5 shadow-lg ${
                    locale === "he" ? "right-0" : "left-0"
                  } top-full`}
                  dir="ltr"
                  onClick={(e) => e.stopPropagation()}
                >
                  {[1, 2, 3, 4].map((cid) => {
                    const labels: Record<number, string> = {
                      1: t.colorYellow,
                      2: t.colorGreen,
                      3: t.colorPink,
                      4: t.colorBlue,
                    };
                    return (
                      <button
                        key={cid}
                        type="button"
                        title={labels[cid]}
                        onClick={() => applyColor(i, cid)}
                        className={`h-5 w-5 rounded-full border border-border ${COLOR_SWATCH[cid]} ${
                          h?.colorId === cid ? "ring-2 ring-foreground/60" : ""
                        }`}
                      />
                    );
                  })}
                  <span className="mx-1 h-4 w-px bg-border" />
                  <button
                    type="button"
                    title={h?.note ? t.editNote : t.addNote}
                    onClick={() => {
                      setActiveIndex(null);
                      setNoteEditing({ index: i, value: h?.note ?? "" });
                    }}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {h?.note ? <Pencil className="h-3.5 w-3.5" /> : <StickyNote className="h-3.5 w-3.5" />}
                  </button>
                  {h && (
                    <button
                      type="button"
                      title={t.removeHighlight}
                      onClick={() => removeHighlight(i)}
                      className="rounded p-1 text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    title="close"
                    onClick={() => setActiveIndex(null)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <Dialog open={noteEditing !== null} onOpenChange={(o) => { if (!o) setNoteEditing(null); }}>
        <DialogContent dir={locale === "he" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t.noteTitle}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={noteEditing?.value ?? ""}
            onChange={(e) =>
              setNoteEditing((n) => (n ? { ...n, value: e.target.value } : n))
            }
            placeholder={t.notePlaceholder}
            rows={5}
            className="resize-none"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            {noteEditing?.value ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setNoteEditing((n) => (n ? { ...n, value: "" } : n))}
              >
                {t.clearNote}
              </Button>
            ) : null}
            <Button type="button" onClick={saveNote}>{t.saveNote}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
