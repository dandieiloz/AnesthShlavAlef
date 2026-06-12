import type { AdditiveScore } from "../types";
import { bi, binary } from "./_helpers";

/**
 * STOP-BANG questionnaire for obstructive sleep apnea risk. Eight items, each
 * worth 1 point. Miller's Anesthesia 10e, Ch 9 (Sleep Medicine) and Ch 28
 * (Preoperative Evaluation).
 */
export const stopbang: AdditiveScore = {
  id: "stopbang",
  abbrev: "STOP-BANG",
  kind: "additive",
  category: "sleepAirway",
  name: bi("שאלון STOP-BANG", "STOP-BANG questionnaire"),
  blurb: bi(
    "הערכת סיכון לדום נשימה חסימתי בשינה לפי שמונה פריטים.",
    "Screens risk of obstructive sleep apnea across eight items.",
  ),
  miller: {
    primary: { chapter: 9, title: bi("רפואת שינה", "Sleep Medicine") },
    also: [{ chapter: 28, title: bi("הערכה טרום‑ניתוחית", "Preoperative Evaluation") }],
  },
  components: [
    binary("snore", bi("נחירות חזקות (Snoring)", "Loud snoring"), 1),
    binary("tired", bi("עייפות או ישנוניות ביום (Tired)", "Daytime tiredness"), 1),
    binary("observed", bi("הפסקות נשימה נצפות (Observed apnea)", "Observed apnea"), 1),
    binary("pressure", bi("יתר לחץ דם מטופל (Pressure)", "Treated hypertension"), 1),
    binary("bmi", bi("BMI מעל 35 ק\"ג/מ\"ר", "BMI over 35 kg/m²"), 1),
    binary("age", bi("גיל מעל 50", "Age over 50"), 1),
    binary(
      "neck",
      bi(
        "היקף צוואר גדול (>43 ס\"מ בגברים / >41 ס\"מ בנשים)",
        "Large neck circumference (>43 cm men / >41 cm women)",
      ),
      1,
    ),
    binary("gender", bi("מין זכר", "Male sex"), 1),
  ],
  interpretation: [
    { min: 0, max: 2, label: bi("סיכון נמוך", "Low risk"), detail: bi("0–2 נקודות", "0–2 points") },
    { min: 3, max: 4, label: bi("סיכון בינוני", "Intermediate risk"), detail: bi("3–4 נקודות", "3–4 points") },
    { min: 5, max: 8, label: bi("סיכון גבוה", "High risk"), detail: bi("5–8 נקודות", "5–8 points") },
  ],
  ask: ["total", "band"],
};
