import type { ClassifyScore } from "../types";
import { bi } from "./_helpers";

/**
 * RIFLE criteria for acute kidney injury — Risk, Injury, Failure, Loss, and
 * End-stage kidney disease, defined by serum creatinine / GFR change or urine
 * output. Miller's Anesthesia 10e, Ch 38 (Renal Pathophysiology) / Ch 79
 * (Acute Kidney Injury / Critical Care).
 */
export const rifle: ClassifyScore = {
  id: "rifle",
  abbrev: "RIFLE",
  kind: "classify",
  category: "renal",
  name: bi("קריטריוני RIFLE לאי‑ספיקת כליות חריפה", "RIFLE criteria for acute kidney injury"),
  blurb: bi(
    "סיווג פגיעה כלייתית חריפה לפי קריאטינין/GFR ותפוקת שתן.",
    "Stages acute kidney injury by creatinine/GFR and urine output.",
  ),
  miller: {
    primary: { chapter: 79, title: bi("פגיעה כלייתית חריפה וטיפול נמרץ", "Acute Kidney Injury / Critical Care") },
    also: [{ chapter: 38, title: bi("פתופיזיולוגיה של הכליה", "Renal Pathophysiology") }],
  },
  categories: [
    {
      id: "risk",
      label: bi("Risk (סיכון)", "Risk"),
      order: 1,
      presentations: [
        bi("עלייה בקריאטינין פי 1.5 מהבסיס", "Serum creatinine rise to 1.5× baseline"),
        bi("ירידה ב‑GFR מעל 25%", "GFR decrease greater than 25%"),
        bi("תפוקת שתן מתחת ל‑0.5 מ\"ל/ק\"ג/שעה במשך 6 שעות", "Urine output below 0.5 mL/kg/h for 6 hours"),
      ],
      detail: bi("קריאטינין ×1.5, או ירידת GFR > 25%, או תפוקת שתן < 0.5 מ\"ל/ק\"ג/שעה ×6 שעות", "Creatinine ×1.5, or GFR drop > 25%, or UO < 0.5 mL/kg/h ×6 h"),
    },
    {
      id: "injury",
      label: bi("Injury (פגיעה)", "Injury"),
      order: 2,
      presentations: [
        bi("עלייה בקריאטינין פי 2 מהבסיס", "Serum creatinine rise to 2× baseline"),
        bi("ירידה ב‑GFR מעל 50%", "GFR decrease greater than 50%"),
        bi("תפוקת שתן מתחת ל‑0.5 מ\"ל/ק\"ג/שעה במשך 12 שעות", "Urine output below 0.5 mL/kg/h for 12 hours"),
      ],
      detail: bi("קריאטינין ×2, או ירידת GFR > 50%, או תפוקת שתן < 0.5 מ\"ל/ק\"ג/שעה ×12 שעות", "Creatinine ×2, or GFR drop > 50%, or UO < 0.5 mL/kg/h ×12 h"),
    },
    {
      id: "failure",
      label: bi("Failure (אי‑ספיקה)", "Failure"),
      order: 3,
      presentations: [
        bi("עלייה בקריאטינין פי 3 מהבסיס", "Serum creatinine rise to 3× baseline"),
        bi("קריאטינין מעל 4 מ\"ג/ד\"ל עם עלייה חריפה", "Serum creatinine above 4 mg/dL with acute rise"),
        bi("תפוקת שתן מתחת ל‑0.3 מ\"ל/ק\"ג/שעה במשך 24 שעות או אנוריה 12 שעות", "Urine output below 0.3 mL/kg/h for 24 hours or anuria for 12 hours"),
      ],
      detail: bi(
        "קריאטינין ×3, או GFR ↓>75%, או קריאטינין ≥ 4 מ\"ג/ד\"ל, או תפוקת שתן < 0.3 מ\"ל/ק\"ג/שעה ×24 שעות / אנוריה ×12 שעות",
        "Creatinine ×3, or GFR drop > 75%, or creatinine ≥ 4 mg/dL, or UO < 0.3 mL/kg/h ×24 h / anuria ×12 h",
      ),
    },
    {
      id: "loss",
      label: bi("Loss (אובדן)", "Loss"),
      order: 4,
      presentations: [
        bi("אובדן מלא של תפקוד כלייתי הדורש דיאליזה מעל 4 שבועות", "Complete loss of kidney function requiring dialysis for over 4 weeks"),
        bi("צורך ב‑RRT מתמשך מעבר ל‑4 שבועות", "Persistent need for RRT beyond 4 weeks"),
      ],
      detail: bi("אי‑ספיקה כלייתית מתמשכת (RRT) מעל 4 שבועות", "Persistent kidney failure (RRT) for more than 4 weeks"),
    },
    {
      id: "eskd",
      label: bi("ESKD (מחלה סופנית)", "ESKD"),
      order: 5,
      presentations: [
        bi("מחלת כליות סופנית הדורשת דיאליזה מעל 3 חודשים", "End-stage kidney disease requiring dialysis for over 3 months"),
        bi("תלות קבועה ב‑RRT מעבר ל‑3 חודשים", "Permanent RRT dependence beyond 3 months"),
      ],
      detail: bi("מחלת כליות סופנית (RRT) מעל 3 חודשים", "End-stage kidney disease (RRT) for more than 3 months"),
    },
  ],
};
