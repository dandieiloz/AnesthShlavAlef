/**
 * Central registry of clinical scores and their categories.
 *
 * To add a new score: create a file in definitions/, import it here, and add it
 * to SCORE_SYSTEMS. Everything else (picker, runner, verification) is driven by
 * this registry, so no other file needs to change.
 */
import type { ScoreCategory, ScoreSystem } from "./types";
import { bi } from "./definitions/_helpers";

import { apfel } from "./definitions/apfel";
import { koivuranta } from "./definitions/koivuranta";
import { aldrete } from "./definitions/aldrete";
import { stopbang } from "./definitions/stopbang";
import { rcri } from "./definitions/rcri";
import { cha2ds2vasc } from "./definitions/cha2ds2vasc";
import { pacemaker } from "./definitions/pacemaker";
import { ariscat } from "./definitions/ariscat";
import { gcs } from "./definitions/gcs";
import { hunthess } from "./definitions/hunthess";
import { fisher } from "./definitions/fisher";
import { rifle } from "./definitions/rifle";
import { childpugh } from "./definitions/childpugh";
import { westhaven } from "./definitions/westhaven";
import { apgar } from "./definitions/apgar";

export const SCORE_CATEGORIES: ScoreCategory[] = [
  { id: "ponvPacu", order: 1, label: bi("בחילה/הקאה והתאוששות", "PONV & Recovery") },
  { id: "sleepAirway", order: 2, label: bi("שינה ונתיב אוויר", "Sleep & Airway") },
  { id: "cardiacPeriop", order: 3, label: bi("לב וסיכון סב‑ניתוחי", "Cardiac & Perioperative") },
  { id: "pulmonary", order: 4, label: bi("ריאות", "Pulmonary") },
  { id: "neuro", order: 5, label: bi("נוירולוגיה", "Neurology") },
  { id: "renal", order: 6, label: bi("כליות", "Renal") },
  { id: "hepatic", order: 7, label: bi("כבד", "Hepatic") },
  { id: "obstetric", order: 8, label: bi("מיילדות ויילוד", "Obstetric & Neonatal") },
];

export const SCORE_SYSTEMS: ScoreSystem[] = [
  apfel,
  koivuranta,
  aldrete,
  stopbang,
  rcri,
  cha2ds2vasc,
  ariscat,
  gcs,
  hunthess,
  fisher,
  rifle,
  childpugh,
  westhaven,
  apgar,
  pacemaker,
];

const SCORE_BY_ID = new Map<string, ScoreSystem>(SCORE_SYSTEMS.map((s) => [s.id, s]));

export function getScoreById(id: string): ScoreSystem | undefined {
  return SCORE_BY_ID.get(id);
}

export interface ScoreGroup {
  category: ScoreCategory;
  scores: ScoreSystem[];
}

/** Scores grouped by category, in category order, dropping empty categories. */
export function scoresByCategory(): ScoreGroup[] {
  return SCORE_CATEGORIES.map((category) => ({
    category,
    scores: SCORE_SYSTEMS.filter((s) => s.category === category.id),
  })).filter((group) => group.scores.length > 0);
}
