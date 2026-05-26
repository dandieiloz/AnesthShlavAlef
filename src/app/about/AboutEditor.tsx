"use client";

import { useState, useTransition } from "react";
import { Pencil, Check, X } from "lucide-react";
import { updateSiteContentAction } from "./actions";

interface EditableSectionProps {
  contentKey: string;
  value: string;
  isAdmin: boolean;
}

export function EditableSection({ contentKey, value, isAdmin }: EditableSectionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [current, setCurrent] = useState(value);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      await updateSiteContentAction(contentKey, draft);
      setCurrent(draft);
      setEditing(false);
    });
  }

  function handleCancel() {
    setDraft(current);
    setEditing(false);
  }

  return (
    <div className="relative group">
      {isAdmin && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="absolute top-0 end-0 p-1.5 text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 rounded"
          title="ערוך קטע"
          aria-label="ערוך קטע"
        >
          <Pencil className="h-4 w-4" />
        </button>
      )}

      {editing ? (
        <div className="space-y-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={8}
            className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm leading-relaxed resize-y min-h-[120px] focus:outline-none focus:ring-2 focus:ring-ring text-foreground"
            dir="rtl"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
              {isPending ? "שומר..." : "שמור"}
            </button>
            <button
              onClick={handleCancel}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              ביטול
            </button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground/85">
          {current}
        </p>
      )}
    </div>
  );
}
