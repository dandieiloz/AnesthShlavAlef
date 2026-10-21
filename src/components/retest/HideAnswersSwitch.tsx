"use client";
import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { setHideAnswers, useHideAnswers } from "./hide-answers";

/** Toggle that covers answers on every re-test card on the page. */
export function HideAnswersSwitch({ label, className }: { label: string; className?: string }) {
  const hidden = useHideAnswers();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={hidden}
      onClick={() => setHideAnswers(!hidden)}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        hidden ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <EyeOff className="h-3.5 w-3.5" />
      {label}
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-7 rounded-full transition-colors",
          hidden ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
            hidden ? "start-3.5" : "start-0.5",
          )}
        />
      </span>
    </button>
  );
}
