import type { ClassifyScore } from "../types";
import { bi } from "./_helpers";

/**
 * Classification of left ventricular systolic function by ejection fraction
 * (Miller's Anesthesia, Table 33.4). The normal/mild boundaries are sex-
 * specific (women tolerate a slightly higher EF before being called normal),
 * so each presentation states both the patient's sex and a concrete EF, and the
 * stated value unambiguously falls in its category for that sex. Moderate and
 * severe thresholds are identical for both sexes.
 *
 * Sex-specific ranges:
 *   Normal    — male 52–72% · female 54–74%
 *   Mild      — male 41–51% · female 41–53%
 *   Moderate  — 30–40% (both)
 *   Severe    — < 30% (both)
 */
export const lvef: ClassifyScore = {
  id: "lvef",
  abbrev: "LVEF",
  kind: "classify",
  category: "cardiacPeriop",
  name: bi(
    "סיווג תפקוד סיסטולי של חדר שמאל לפי מקטע פליטה",
    "LV systolic function by ejection fraction",
  ),
  blurb: bi(
    "דירוג תפקוד סיסטולי של חדר שמאל לפי מקטע פליטה (EF), עם ספים תלויי‑מין.",
    "Grades LV systolic function by ejection fraction, with sex-specific cutoffs.",
  ),
  miller: {
    primary: { chapter: 33, title: bi("אקוקרדיוגרפיה סב‑ניתוחית", "Perioperative Echocardiography") },
  },
  categories: [
    {
      id: "normal",
      label: bi("תפקוד תקין", "Normal"),
      order: 1,
      presentations: [
        bi("מטופל זכר, מקטע פליטה (EF) 60%", "Male patient, ejection fraction (EF) 60%"),
        bi("מטופל זכר, מקטע פליטה 70%", "Male patient, ejection fraction 70%"),
        bi("מטופלת, מקטע פליטה 65%", "Female patient, ejection fraction 65%"),
        // Female-only boundary: 54% is normal in women but only mild range starts higher.
        bi("מטופלת, מקטע פליטה 55%", "Female patient, ejection fraction 55%"),
      ],
      detail: bi("EF תקין: זכר 52%–72% · נקבה 54%–74%", "Normal EF: male 52%–72% · female 54%–74%"),
    },
    {
      id: "mild",
      label: bi("הפרעה קלה", "Mild dysfunction"),
      order: 2,
      presentations: [
        bi("מטופל זכר, מקטע פליטה 45%", "Male patient, ejection fraction 45%"),
        bi("מטופל זכר, מקטע פליטה 50%", "Male patient, ejection fraction 50%"),
        // Female-specific boundary: 52% is mild in women but normal in men.
        bi("מטופלת, מקטע פליטה 52%", "Female patient, ejection fraction 52%"),
        bi("מטופלת, מקטע פליטה 45%", "Female patient, ejection fraction 45%"),
      ],
      detail: bi(
        "הפרעה קלה: זכר 41%–51% · נקבה 41%–53%",
        "Mild dysfunction: male 41%–51% · female 41%–53%",
      ),
    },
    {
      id: "moderate",
      label: bi("הפרעה בינונית", "Moderate dysfunction"),
      order: 3,
      presentations: [
        bi("מטופל זכר, מקטע פליטה 35%", "Male patient, ejection fraction 35%"),
        bi("מטופלת, מקטע פליטה 38%", "Female patient, ejection fraction 38%"),
        bi("מטופל זכר, מקטע פליטה 32%", "Male patient, ejection fraction 32%"),
      ],
      detail: bi("הפרעה בינונית: 30%–40% (בשני המינים)", "Moderate dysfunction: 30%–40% (both sexes)"),
    },
    {
      id: "severe",
      label: bi("הפרעה קשה", "Severe dysfunction"),
      order: 4,
      presentations: [
        bi("מטופל זכר, מקטע פליטה 25%", "Male patient, ejection fraction 25%"),
        bi("מטופלת, מקטע פליטה 20%", "Female patient, ejection fraction 20%"),
        bi("מטופל זכר, מקטע פליטה 28%", "Male patient, ejection fraction 28%"),
      ],
      detail: bi("הפרעה קשה: מתחת ל‑30% (בשני המינים)", "Severe dysfunction: below 30% (both sexes)"),
    },
  ],
  scaleTable: {
    columns: [bi("זכר", "Male"), bi("נקבה", "Female")],
    rows: [
      { categoryId: "normal", cells: [bi("52%–72%", "52%–72%"), bi("54%–74%", "54%–74%")] },
      { categoryId: "mild", cells: [bi("41%–51%", "41%–51%"), bi("41%–53%", "41%–53%")] },
      { categoryId: "moderate", cells: [bi("30%–40%", "30%–40%"), bi("30%–40%", "30%–40%")] },
      { categoryId: "severe", cells: [bi("< 30%", "< 30%"), bi("< 30%", "< 30%")] },
    ],
  },
};
