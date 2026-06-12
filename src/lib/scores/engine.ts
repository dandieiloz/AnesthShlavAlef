/**
 * Pure scoring helpers shared by the question generator and the verification
 * script. No randomness, no DOM — just deterministic computation.
 */
import type { ClassifyCategory, InterpretationBand, ScoreComponent } from "./types";

/** Find the interpretation band a total falls into (inclusive ranges). */
export function findBand(
  bands: InterpretationBand[],
  total: number,
): InterpretationBand | undefined {
  return bands.find((b) => total >= b.min && total <= b.max);
}

/** Min/max achievable total for an additive score, derived from its components. */
export function totalRange(components: ScoreComponent[]): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const comp of components) {
    const points = comp.options.map((o) => o.points);
    min += Math.min(...points);
    max += Math.max(...points);
  }
  return { min, max };
}

/**
 * Advance `steps` categories toward the most-severe (highest `order`) category,
 * clamped to the available range. Used by classify scores with an adjust rule
 * (e.g. Hunt & Hess comorbidity bump).
 */
export function adjustCategory(
  categories: ClassifyCategory[],
  baseId: string,
  steps: number,
): ClassifyCategory {
  const sorted = [...categories].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((c) => c.id === baseId);
  if (idx === -1) throw new Error(`adjustCategory: unknown category ${baseId}`);
  const target = Math.min(sorted.length - 1, Math.max(0, idx + steps));
  return sorted[target];
}
