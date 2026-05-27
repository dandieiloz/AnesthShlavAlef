"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { setLocaleAction } from "@/app/(user)/locale-actions";

interface LocaleToggleProps {
  current: "he" | "en";
}

export function LocaleToggle({ current }: LocaleToggleProps) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = current === "he" ? "en" : "he";
    // Optimistic cookie write so the UI feels instant on the next navigation
    document.cookie = `locale=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startTransition(() => setLocaleAction(next));
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      disabled={isPending}
      className="h-8 px-2 text-xs font-semibold tracking-wide"
      title={current === "he" ? "Switch to English" : "עבור לעברית"}
    >
      {current === "he" ? "EN" : "עב"}
    </Button>
  );
}
