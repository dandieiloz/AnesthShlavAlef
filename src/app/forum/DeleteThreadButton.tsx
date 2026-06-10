"use client";
import { useTransition } from "react";
import { deleteThreadAction } from "./actions";
import { Trash2 } from "lucide-react";

export function DeleteThreadButton({ threadId, label, confirmText }: { threadId: string; label: string; confirmText: string }) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(confirmText)) return;
    const fd = new FormData();
    fd.set("threadId", threadId);
    startTransition(() => deleteThreadAction(fd));
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
