import type { AdditiveScore } from "../types";
import { bi, binary, opt } from "./_helpers";

/**
 * ARISCAT score for postoperative pulmonary complications. Seven weighted
 * predictors; the total maps to a low / intermediate / high risk band.
 * Miller's Anesthesia 10e, Ch 28 (Preoperative Evaluation).
 */
export const ariscat: AdditiveScore = {
  id: "ariscat",
  abbrev: "ARISCAT",
  kind: "additive",
  category: "pulmonary",
  name: bi("ציון ARISCAT", "ARISCAT score"),
  blurb: bi(
    "ניבוי סיבוכים ריאתיים אחרי ניתוח לפי מנבאים משוקללים.",
    "Predicts postoperative pulmonary complications from weighted predictors.",
  ),
  miller: {
    primary: { chapter: 28, title: bi("הערכה טרום‑ניתוחית", "Preoperative Evaluation") },
  },
  components: [
    {
      id: "age",
      label: bi("גיל", "Age"),
      options: [
        opt(bi("50 ומטה", "50 or under"), 0, { min: 18, max: 50, unit: "y" }),
        opt(bi("51–80", "51–80"), 3, { min: 51, max: 80, unit: "y" }),
        opt(bi("מעל 80", "Over 80"), 16, { min: 81, max: 95, unit: "y" }),
      ],
    },
    {
      id: "spo2",
      label: bi("ריווי חמצן טרום‑ניתוחי", "Preoperative SpO₂"),
      options: [
        opt(bi("96% ומעלה", "96% or higher"), 0, { min: 96, max: 100, unit: "%" }),
        opt(bi("91–95%", "91–95%"), 8, { min: 91, max: 95, unit: "%" }),
        opt(bi("90% ומטה", "90% or lower"), 24, { min: 85, max: 90, unit: "%" }),
      ],
    },
    binary("infection", bi("זיהום נשימתי בחודש האחרון", "Respiratory infection in the past month"), 17),
    binary("anemia", bi("אנמיה טרום‑ניתוחית (Hb ≤ 10 ג'/ד\"ל)", "Preoperative anemia (Hb ≤ 10 g/dL)"), 11),
    {
      id: "incision",
      label: bi("מיקום החתך הניתוחי", "Surgical incision"),
      options: [
        opt(bi("היקפי", "Peripheral"), 0),
        opt(bi("בטן עליונה", "Upper abdominal"), 15),
        opt(bi("תוך‑חזי", "Intrathoracic"), 24),
      ],
    },
    {
      id: "duration",
      label: bi("משך הניתוח", "Surgery duration"),
      options: [
        opt(bi("עד שעתיים", "Up to 2 hours"), 0),
        opt(bi("שעתיים עד 3 שעות", "2 to 3 hours"), 16),
        opt(bi("מעל 3 שעות", "Over 3 hours"), 23),
      ],
    },
    binary("emergency", bi("ניתוח דחוף", "Emergency procedure"), 8),
  ],
  interpretation: [
    { min: 0, max: 25, label: bi("סיכון נמוך", "Low risk"), detail: bi("מתחת ל‑26 נקודות", "Below 26 points") },
    { min: 26, max: 44, label: bi("סיכון בינוני", "Intermediate risk"), detail: bi("26–44 נקודות", "26–44 points") },
    { min: 45, max: 123, label: bi("סיכון גבוה", "High risk"), detail: bi("45 נקודות ומעלה", "45 points or more") },
  ],
  ask: ["total", "band"],
};
