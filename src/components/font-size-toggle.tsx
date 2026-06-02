"use client";
import { useEffect, useState } from "react";
import { AArrowDown, AArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";

const STEPS = [14, 15, 16, 17, 18];
const DEFAULT_PX = 16;
const STORAGE_KEY = "perl.fontSizePx";

function clampToStep(px: number): number {
  let best = STEPS[0];
  let bestDiff = Math.abs(px - best);
  for (const s of STEPS) {
    const d = Math.abs(px - s);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

export function FontSizeToggle({ t }: { t: { increase: string; decrease: string } }) {
  const [px, setPx] = useState<number>(DEFAULT_PX);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? parseInt(raw, 10) : NaN;
      const initial = Number.isFinite(parsed) ? clampToStep(parsed) : DEFAULT_PX;
      setPx(initial);
      document.documentElement.style.fontSize = `${initial}px`;
    } catch {
      /* ignore */
    }
  }, []);

  const apply = (next: number) => {
    setPx(next);
    document.documentElement.style.fontSize = `${next}px`;
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  const idx = STEPS.indexOf(clampToStep(px));
  const canDec = idx > 0;
  const canInc = idx < STEPS.length - 1;

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => canDec && apply(STEPS[idx - 1])}
        disabled={!canDec}
        aria-label={t.decrease}
        title={t.decrease}
      >
        <AArrowDown className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => canInc && apply(STEPS[idx + 1])}
        disabled={!canInc}
        aria-label={t.increase}
        title={t.increase}
      >
        <AArrowUp className="h-4 w-4" />
      </Button>
    </div>
  );
}
