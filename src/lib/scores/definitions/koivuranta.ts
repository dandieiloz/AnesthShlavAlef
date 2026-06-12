import type { AdditiveScore } from "../types";
import { bi, binary } from "./_helpers";

/**
 * Koivuranta score for PONV — a five-factor variant of Apfel. Each factor is
 * worth 1 point; more risk factors mean a higher risk of nausea/vomiting.
 * Miller's Anesthesia 10e, Ch 76 (PACU).
 */
export const koivuranta: AdditiveScore = {
  id: "koivuranta",
  abbrev: "Koivuranta",
  kind: "additive",
  category: "ponvPacu",
  name: bi("ציון Koivuranta ל‑PONV", "Koivuranta score for PONV"),
  blurb: bi(
    "וריאנט בן חמישה גורמים לניבוי בחילות והקאות אחרי ניתוח.",
    "A five-factor variant for predicting postoperative nausea and vomiting.",
  ),
  miller: {
    primary: { chapter: 76, title: bi("ההתאוששות (PACU)", "The Postanesthesia Care Unit") },
  },
  components: [
    binary("female", bi("מין", "Sex"), 1, {
      yes: bi("אישה", "Woman"),
      no: bi("גבר", "Man"),
      selfDescribing: true,
    }),
    binary("nonsmoker", bi("עישון", "Smoking"), 1, {
      yes: bi("לא מעשן/ת", "Non-smoker"),
      no: bi("מעשן/ת", "Smoker"),
      selfDescribing: true,
    }),
    binary("ponv", bi("היסטוריה של PONV", "History of PONV"), 1),
    binary("motion", bi("היסטוריה של מחלת תנועה", "History of motion sickness"), 1),
    binary("duration", bi("משך ניתוח מעל 60 דקות", "Surgery longer than 60 minutes"), 1),
  ],
  interpretation: [
    { min: 0, max: 1, label: bi("סיכון נמוך", "Low risk"), detail: bi("0–1 גורמי סיכון", "0–1 risk factors") },
    { min: 2, max: 3, label: bi("סיכון בינוני", "Moderate risk"), detail: bi("2–3 גורמי סיכון", "2–3 risk factors") },
    { min: 4, max: 5, label: bi("סיכון גבוה", "High risk"), detail: bi("4–5 גורמי סיכון", "4–5 risk factors") },
  ],
  ask: ["total"],
};
