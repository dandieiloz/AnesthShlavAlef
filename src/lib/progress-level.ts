import type { LucideIcon } from "lucide-react";
import { Wind, WandSparkles, Crown, Gamepad2, Ghost } from "lucide-react";

export type LevelKey = "mask" | "stylet" | "lma" | "glidescope" | "fiberoptic";

export interface LevelDef {
  key: LevelKey;
  /** Tailwind gradient classes for the fill / accents. */
  gradient: string;
  /** Tailwind ring/border accent color. */
  accent: string;
}

export const LEVELS: readonly LevelDef[] = [
  { key: "mask",       gradient: "from-sky-400 to-cyan-500",         accent: "text-sky-500" },
  { key: "stylet",     gradient: "from-emerald-400 to-teal-500",     accent: "text-emerald-500" },
  { key: "lma",        gradient: "from-amber-400 to-orange-500",     accent: "text-amber-500" },
  { key: "glidescope", gradient: "from-violet-500 to-fuchsia-500",   accent: "text-violet-500" },
  { key: "fiberoptic", gradient: "from-rose-500 via-pink-500 to-indigo-500", accent: "text-pink-500" },
] as const;

/** Icon lookup kept separate so `LevelDef` stays serializable across the server/client boundary. */
export const LEVEL_ICONS: Record<LevelKey, LucideIcon> = {
  mask: Wind,
  stylet: WandSparkles,
  lma: Crown,
  glidescope: Gamepad2,
  fiberoptic: Ghost,
};

export interface LevelComputation {
  /** 0-based current tier index. */
  index: number;
  level: LevelDef;
  nextLevel: LevelDef | null;
  solved: number;
  total: number;
  /** Inclusive lower bound of current tier (questions solved when this tier started). */
  levelStart: number;
  /** Exclusive upper bound of current tier (questions solved when next tier starts). */
  levelEnd: number;
  /** Threshold table: cumulative solved count required to *enter* each tier (length 5, [0]=0). */
  thresholds: number[];
  /** Progress within current tier, 0-100. */
  levelProgressPct: number;
  /** Overall progress across the whole pool, 0-100. */
  overallPct: number;
  /** Questions remaining to reach next tier (0 if maxed). */
  toNext: number;
}

/**
 * Compute level state. Splits the pool into 5 tiers as evenly as possible —
 * leftover remainder lands on the final tier so tier 5 always equals exactly `total`.
 */
export function computeLevel(solved: number, total: number): LevelComputation {
  const safeTotal = Math.max(total, 0);
  const safeSolved = Math.max(0, Math.min(solved, safeTotal));

  const base = Math.floor(safeTotal / LEVELS.length);
  const remainder = safeTotal - base * LEVELS.length;
  // Thresholds: [0, base, 2*base, 3*base, 4*base, total]
  const thresholds: number[] = [];
  for (let i = 0; i <= LEVELS.length; i++) {
    if (i < LEVELS.length) thresholds.push(base * i);
    else thresholds.push(base * LEVELS.length + remainder);
  }

  let index = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (safeSolved >= thresholds[i]) { index = i; break; }
  }

  const levelStart = thresholds[index];
  const levelEnd = thresholds[index + 1];
  const span = Math.max(1, levelEnd - levelStart);
  const levelProgressPct = Math.min(100, Math.round(((safeSolved - levelStart) / span) * 100));
  const overallPct = safeTotal === 0 ? 0 : Math.min(100, Math.round((safeSolved / safeTotal) * 100));
  const nextLevel = index < LEVELS.length - 1 ? LEVELS[index + 1] : null;
  const toNext = nextLevel ? Math.max(0, levelEnd - safeSolved) : 0;

  return {
    index,
    level: LEVELS[index],
    nextLevel,
    solved: safeSolved,
    total: safeTotal,
    levelStart,
    levelEnd,
    thresholds,
    levelProgressPct,
    overallPct,
    toNext,
  };
}
