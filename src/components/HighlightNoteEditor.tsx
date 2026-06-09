"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Pencil, StickyNote } from "lucide-react";
import { setHighlightNoteByIdAction } from "@/app/(user)/highlight-actions";

type Props = {
  highlightId: number;
  note: string | null;
  locale: "he" | "en";
  t: {
    addNote: string;
    editNote: string;
    noteTitle: string;
    notePlaceholder: string;
    saveNote: string;
    clearNote: string;
  };
};

export function HighlightNoteEditor({ highlightId, note, locale, t }: Props) {
  const [current, setCurrent] = useState<string | null>(note);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [, startTransition] = useTransition();

  function openEditor() {
    setValue(current ?? "");
    setOpen(true);
  }

  function save() {
    const next = value.trim() || null;
    setCurrent(next);
    setOpen(false);
    startTransition(() => {
      setHighlightNoteByIdAction({ id: highlightId, note: value });
    });
  }

  return (
    <>
      {current ? (
        <div className="flex items-start gap-1.5 rounded border border-amber-300/40 bg-background/50 px-2 py-1 text-xs">
          <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
          <span dir="auto" className="flex-1 text-foreground/85 whitespace-pre-wrap break-words [unicode-bidi:plaintext]">
            {current}
          </span>
          <button
            type="button"
            title={t.editNote}
            onClick={openEditor}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={openEditor}
          className="flex items-center gap-1.5 rounded p-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <StickyNote className="h-3 w-3 shrink-0" />
          {t.addNote}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir={locale === "he" ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle>{t.noteTitle}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t.notePlaceholder}
            rows={5}
            className="resize-none"
          />
          <DialogFooter className="gap-2 sm:gap-2">
            {value ? (
              <Button type="button" variant="ghost" onClick={() => setValue("")}>
                {t.clearNote}
              </Button>
            ) : null}
            <Button type="button" onClick={save}>{t.saveNote}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
