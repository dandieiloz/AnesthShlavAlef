"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toggleBookmarkValueAction } from "@/app/(user)/actions";

export function BookmarkButton({
  questionId,
  initialBookmarked,
  labels,
}: {
  questionId: number;
  initialBookmarked: boolean;
  labels: { add: string; remove: string; bookmarked: string; bookmark: string };
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const optimistic = !bookmarked;
    setBookmarked(optimistic);
    startTransition(() => {
      toggleBookmarkValueAction(questionId)
        .then((r) => setBookmarked(r.bookmarked))
        .catch((err) => {
          console.error("[history] bookmark toggle failed", err);
          setBookmarked(!optimistic);
        });
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={bookmarked ? labels.remove : labels.add}
      className={`flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
        bookmarked
          ? "border-amber-300 text-amber-500 hover:text-amber-600 dark:border-amber-500/40"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
      {bookmarked ? labels.bookmarked : labels.bookmark}
    </button>
  );
}
