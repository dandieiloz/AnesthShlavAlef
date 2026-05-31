"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { TriangleAlert } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

const PRESETS = [10, 20, 50] as const;

export function QuestionLimitPicker({
  availableCount,
  locale,
  defaultAll = false,
}: {
  availableCount?: number;
  locale: Locale;
  defaultAll?: boolean;
}) {
  const t = getDictionary(locale).studyNew;
  const [limit, setLimit] = useState<number | null>(defaultAll ? null : 10);
  const [custom, setCustom] = useState("");

  function selectPreset(n: number) {
    setLimit(n);
    setCustom("");
  }

  function selectAll() {
    setLimit(null);
    setCustom("");
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setCustom(val);
    const n = parseInt(val, 10);
    if (!isNaN(n) && n > 0) {
      setLimit(n);
    } else {
      setLimit(null);
    }
  }

  const isAll = limit === null && custom === "";
  const isCustomActive = custom !== "" && !PRESETS.includes(limit as (typeof PRESETS)[number]);

  const hasAvailable = availableCount !== undefined && availableCount > 0;
  const overLimit = !isAll && limit !== null && hasAvailable && limit > availableCount!;
  const effectiveLimit = overLimit ? availableCount! : limit;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 items-center">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => selectPreset(n)}
            className={`rounded-md border px-3 py-1 text-sm font-medium transition-colors ${
              limit === n && !isCustomActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-foreground hover:border-primary/60"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          onClick={selectAll}
          className={`rounded-md border px-3 py-1 text-sm font-medium transition-colors ${
            isAll
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-background text-foreground hover:border-primary/60"
          }`}
        >
          {t.allLimit}
        </button>
        <Input
          type="number"
          min={1}
          placeholder={t.customLimit}
          value={custom}
          onChange={handleCustomChange}
          className={`w-32 text-sm ${isCustomActive ? "border-primary ring-1 ring-primary" : ""}`}
          dir="ltr"
        />
      </div>
      {overLimit && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {t.overLimit(availableCount!)}
        </p>
      )}

      {effectiveLimit !== null && (
        <input type="hidden" name="questionLimit" value={effectiveLimit} />
      )}
    </div>
  );
}
