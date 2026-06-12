import type { AdditiveScore } from "../types";
import { bi, binary } from "./_helpers";

/**
 * Revised Cardiac Risk Index (RCRI / Lee index) for major non-cardiac surgery.
 * Six predictors, each worth 1 point; the count maps to a risk class and an
 * estimated rate of major cardiac complications. Miller's Anesthesia 10e,
 * Ch 28 (Preoperative Evaluation) / Ch 27 (Risk of Anesthesia).
 */
export const rcri: AdditiveScore = {
  id: "rcri",
  abbrev: "RCRI",
  kind: "additive",
  category: "cardiacPeriop",
  name: bi("מדד סיכון לבבי מתוקן (RCRI)", "Revised Cardiac Risk Index"),
  blurb: bi(
    "הערכת סיכון לסיבוכים לבביים סב‑ניתוחיים לפי שישה מנבאים.",
    "Estimates perioperative cardiac risk from six predictors.",
  ),
  miller: {
    primary: { chapter: 28, title: bi("הערכה טרום‑ניתוחית", "Preoperative Evaluation") },
    also: [{ chapter: 27, title: bi("הסיכון שבהרדמה", "Risk of Anesthesia") }],
  },
  components: [
    binary(
      "highRiskSurgery",
      bi(
        "ניתוח בסיכון גבוה (תוך‑בטני, תוך‑חזי או וסקולרי מעל המפשעה)",
        "High-risk surgery (intraperitoneal, intrathoracic, or suprainguinal vascular)",
      ),
      1,
    ),
    binary("ihd", bi("מחלת לב איסכמית", "Ischemic heart disease"), 1),
    binary("chf", bi("אי‑ספיקת לב", "Congestive heart failure"), 1),
    binary("cva", bi("מחלה צרברו‑וסקולרית (אירוע מוחי / TIA)", "Cerebrovascular disease (stroke / TIA)"), 1),
    binary("insulin", bi("טיפול באינסולין לפני הניתוח", "Preoperative insulin therapy"), 1),
    binary(
      "creatinine",
      bi("קריאטינין מעל 2.0 מ\"ג/ד\"ל (176 מיקרומול/ל)", "Creatinine above 2.0 mg/dL (176 µmol/L)"),
      1,
    ),
  ],
  interpretation: [
    { min: 0, max: 0, label: bi("Class I", "Class I"), detail: bi("סיכון ~1.6%", "~1.6% risk") },
    { min: 1, max: 1, label: bi("Class II", "Class II"), detail: bi("סיכון ~4.0%", "~4.0% risk") },
    { min: 2, max: 2, label: bi("Class III", "Class III"), detail: bi("סיכון ~7.9%", "~7.9% risk") },
    { min: 3, max: 6, label: bi("Class IV", "Class IV"), detail: bi("סיכון ~12.9%", "~12.9% risk") },
  ],
  ask: ["total", "band"],
};
