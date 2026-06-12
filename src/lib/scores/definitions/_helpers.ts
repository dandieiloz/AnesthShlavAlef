/**
 * Small shared constructors for score definitions. Keeps the per-score files
 * declarative and reduces copy-paste errors for the common binary component.
 */
import type { Bilingual, ScoreComponent, ScoreOption } from "../types";

export function bi(he: string, en: string): Bilingual {
  return { he, en };
}

/**
 * A present/absent component. "Absent" scores 0; "present" scores `points`.
 * Defaults to Yes/No value labels; override for natural phrasing.
 */
export function binary(
  id: string,
  label: Bilingual,
  points: number,
  override?: { yes?: Bilingual; no?: Bilingual },
): ScoreComponent {
  return {
    id,
    label,
    options: [
      { value: override?.no ?? bi("לא", "No"), points: 0 },
      { value: override?.yes ?? bi("כן", "Yes"), points },
    ],
  };
}

/** A 0–2 sub-score component (Apgar / Aldrete style). */
export function triple(
  id: string,
  label: Bilingual,
  zero: Bilingual,
  one: Bilingual,
  two: Bilingual,
): ScoreComponent {
  return {
    id,
    label,
    options: [
      { value: zero, points: 0 },
      { value: one, points: 1 },
      { value: two, points: 2 },
    ],
  };
}

export function opt(value: Bilingual, points: number, sample?: ScoreOption["sample"]): ScoreOption {
  return { value, points, sample };
}
