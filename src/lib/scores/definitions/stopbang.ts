import type { AdditiveScore, ScoreComponent } from "../types";
import { bi, binary, opt } from "./_helpers";

// Neck-circumference option values, shared between the rubric options and the
// derive hook so the breakdown highlights the right row.
const NECK_OVER = bi(
  "מעל הסף לפי מין (גבר >43 ס\"מ / אישה >41 ס\"מ)",
  "Above the sex-specific threshold (man >43 cm / woman >41 cm)",
);
const NECK_UNDER = bi("מתחת לסף לפי מין", "Below the sex-specific threshold");

/**
 * Neck circumference: a concrete value is shown (no threshold hint), and the
 * point is awarded only if it exceeds the patient's sex-specific cutoff
 * (man >43 cm ≈ 17″, woman >41 cm ≈ 16″). Depends on the `gender` component, so
 * `gender` must appear before `neck` in `components`.
 */
const neck: ScoreComponent = {
  id: "neck",
  label: bi("היקף צוואר", "Neck circumference"),
  options: [opt(NECK_OVER, 1), opt(NECK_UNDER, 0)],
  derive: ({ rng, chosen }) => {
    const male = chosen.gender?.points === 1;
    const threshold = male ? 43 : 41;
    const cm = Math.round(36 + rng() * 12); // 36–48 cm spread around both cutoffs
    const over = cm > threshold;
    return {
      points: over ? 1 : 0,
      shown: bi(`${cm} ס"מ`, `${cm} cm`),
      value: over ? NECK_OVER : NECK_UNDER,
    };
  },
};

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
    // Sex is resolved before neck so the neck threshold can depend on it.
    binary("gender", bi("מין", "Sex"), 1, {
      yes: bi("זכר", "Male"),
      no: bi("נקבה", "Female"),
      selfDescribing: true,
    }),
    neck,
  ],
  interpretation: [
    { min: 0, max: 2, label: bi("סיכון נמוך", "Low risk"), detail: bi("0–2 נקודות", "0–2 points") },
    { min: 3, max: 4, label: bi("סיכון בינוני", "Intermediate risk"), detail: bi("3–4 נקודות", "3–4 points") },
    { min: 5, max: 8, label: bi("סיכון גבוה", "High risk"), detail: bi("5–8 נקודות", "5–8 points") },
  ],
  ask: ["total", "band"],
};
