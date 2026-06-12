import type { AdditiveScore } from "../types";
import { bi, binary, opt } from "./_helpers";

/**
 * CHA₂DS₂-VASc score for stroke / thromboembolism risk in atrial fibrillation.
 * Age ≥75 and prior stroke/TIA/thromboembolism are worth 2 points; the other
 * factors are worth 1. Miller's Anesthesia 10e, Ch 51 (Cardiac Rhythm
 * Management) / Ch 28 (Preoperative Evaluation).
 */
export const cha2ds2vasc: AdditiveScore = {
  id: "cha2ds2vasc",
  abbrev: "CHA₂DS₂-VASc",
  kind: "additive",
  category: "cardiacPeriop",
  name: bi("ציון CHA₂DS₂-VASc", "CHA₂DS₂-VASc score"),
  blurb: bi(
    "הערכת סיכון לאירוע מוחי בפרפור פרוזדורים.",
    "Estimates stroke risk in atrial fibrillation.",
  ),
  miller: {
    primary: { chapter: 51, title: bi("הפרעות קצב לב", "Cardiac Arrhythmias") },
    also: [{ chapter: 28, title: bi("הערכה טרום‑ניתוחית", "Preoperative Evaluation") }],
  },
  components: [
    binary("chf", bi("אי‑ספיקת לב / תפקוד חדר שמאל ירוד", "Heart failure / LV dysfunction"), 1),
    binary("htn", bi("יתר לחץ דם", "Hypertension"), 1),
    {
      id: "age",
      label: bi("גיל", "Age"),
      options: [
        opt(bi("מתחת ל‑65", "Under 65"), 0, { min: 40, max: 64, unit: "y" }),
        opt(bi("65–74", "65–74"), 1, { min: 65, max: 74, unit: "y" }),
        opt(bi("75 ומעלה", "75 or older"), 2, { min: 75, max: 92, unit: "y" }),
      ],
    },
    binary("diabetes", bi("סוכרת", "Diabetes mellitus"), 1),
    binary(
      "stroke",
      bi("אירוע מוחי / TIA / תרומבואמבוליזם בעבר", "Prior stroke / TIA / thromboembolism"),
      2,
    ),
    binary(
      "vascular",
      bi("מחלה וסקולרית (אוטם, PAD, רובד אאורטלי)", "Vascular disease (MI, PAD, aortic plaque)"),
      1,
    ),
    {
      id: "sex",
      label: bi("מין", "Sex"),
      options: [
        opt(bi("זכר", "Male"), 0),
        opt(bi("נקבה", "Female"), 1),
      ],
    },
  ],
  interpretation: [
    { min: 0, max: 0, label: bi("סיכון נמוך", "Low risk"), detail: bi("ציון 0", "Score 0") },
    { min: 1, max: 1, label: bi("סיכון בינוני", "Intermediate risk"), detail: bi("ציון 1", "Score 1") },
    { min: 2, max: 9, label: bi("סיכון גבוה", "High risk"), detail: bi("ציון 2 ומעלה", "Score 2 or above") },
  ],
  ask: ["total"],
};
