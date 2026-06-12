import type { DecodeScore } from "../types";
import { bi } from "./_helpers";

/**
 * NBG / NASPE-BPEG generic pacemaker code (Bernstein 2002). Five positions
 * describe chamber(s) paced, sensed, the response to sensing, rate modulation,
 * and multisite pacing. Miller's Anesthesia 10e, Ch 34 (Pacemakers and
 * Implantable Cardioverter-Defibrillators).
 */
export const pacemaker: DecodeScore = {
  id: "pacemaker",
  abbrev: "NBG",
  kind: "decode",
  category: "cardiacPeriop",
  name: bi("קוד קוצב הלב (NBG / NASPE-BPEG)", "Pacemaker code (NBG / NASPE-BPEG)"),
  blurb: bi(
    "פענוח חמש העמדות של קוד קוצב הלב הגנרי.",
    "Decodes the five positions of the generic pacemaker code.",
  ),
  miller: {
    primary: {
      chapter: 34,
      title: bi("קוצבי לב ודפיברילטורים מושתלים", "Pacemakers and Implantable Cardioverter-Defibrillators"),
    },
  },
  positions: [
    {
      index: 1,
      name: bi("עמדה I — חדר מקוצב", "Position I — Chamber Paced"),
      letters: [
        { code: "O", meaning: bi("ללא", "None") },
        { code: "A", meaning: bi("עליה", "Atrium") },
        { code: "V", meaning: bi("חדר", "Ventricle") },
        { code: "D", meaning: bi("כפול (עליה + חדר)", "Dual (atrium + ventricle)") },
      ],
    },
    {
      index: 2,
      name: bi("עמדה II — חדר נחוש", "Position II — Chamber Sensed"),
      letters: [
        { code: "O", meaning: bi("ללא", "None") },
        { code: "A", meaning: bi("עליה", "Atrium") },
        { code: "V", meaning: bi("חדר", "Ventricle") },
        { code: "D", meaning: bi("כפול (עליה + חדר)", "Dual (atrium + ventricle)") },
      ],
    },
    {
      index: 3,
      name: bi("עמדה III — תגובה לחישה", "Position III — Response to Sensing"),
      letters: [
        { code: "O", meaning: bi("ללא", "None") },
        { code: "T", meaning: bi("מופעל (Triggered)", "Triggered") },
        { code: "I", meaning: bi("מעוכב (Inhibited)", "Inhibited") },
        { code: "D", meaning: bi("כפול (מופעל + מעוכב)", "Dual (triggered + inhibited)") },
      ],
    },
    {
      index: 4,
      name: bi("עמדה IV — ויסות קצב", "Position IV — Rate Modulation"),
      letters: [
        { code: "O", meaning: bi("ללא", "None") },
        { code: "R", meaning: bi("ויסות קצב (Rate modulation)", "Rate modulation") },
      ],
    },
    {
      index: 5,
      name: bi("עמדה V — קיצוב רב‑מוקדי", "Position V — Multisite Pacing"),
      letters: [
        { code: "O", meaning: bi("ללא", "None") },
        { code: "A", meaning: bi("עליה", "Atrium") },
        { code: "V", meaning: bi("חדר", "Ventricle") },
        { code: "D", meaning: bi("כפול (עליה + חדר)", "Dual (atrium + ventricle)") },
      ],
    },
  ],
  sampleCodes: ["DDD", "VVI", "AAI", "VDD", "DDDR", "VOO", "AOO", "DOO"],
  ask: ["decodeMeaning", "decodeCode"],
};
