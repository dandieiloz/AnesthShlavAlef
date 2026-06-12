import type { AdditiveScore } from "../types";
import { bi, binary } from "./_helpers";

/**
 * Apfel score for postoperative nausea and vomiting (PONV).
 * Four independent risk factors, each worth 1 point; the total predicts the
 * incidence of PONV. Miller's Anesthesia 10e, Ch 76 (PACU).
 */
export const apfel: AdditiveScore = {
  id: "apfel",
  abbrev: "Apfel",
  kind: "additive",
  category: "ponvPacu",
  name: bi("ציון Apfel ל‑PONV", "Apfel score for PONV"),
  blurb: bi(
    "ניבוי בחילות והקאות אחרי ניתוח לפי ארבעה גורמי סיכון.",
    "Predicts postoperative nausea and vomiting from four risk factors.",
  ),
  miller: {
    primary: { chapter: 76, title: bi("ההתאוששות (PACU)", "The Postanesthesia Care Unit") },
  },
  components: [
    binary("female", bi("מין נקבה", "Female sex"), 1),
    binary("nonsmoker", bi("לא מעשן/ת", "Non-smoker"), 1),
    binary(
      "history",
      bi("היסטוריה של PONV או מחלת תנועה", "History of PONV or motion sickness"),
      1,
    ),
    binary(
      "opioids",
      bi("שימוש באופיואידים אחרי הניתוח", "Postoperative opioid use"),
      1,
    ),
  ],
  interpretation: [
    { min: 0, max: 0, label: bi("~10%", "~10%"), detail: bi("0 גורמי סיכון", "0 risk factors") },
    { min: 1, max: 1, label: bi("~20%", "~20%"), detail: bi("גורם סיכון אחד", "1 risk factor") },
    { min: 2, max: 2, label: bi("~40%", "~40%"), detail: bi("2 גורמי סיכון", "2 risk factors") },
    { min: 3, max: 3, label: bi("~60%", "~60%"), detail: bi("3 גורמי סיכון", "3 risk factors") },
    { min: 4, max: 4, label: bi("~80%", "~80%"), detail: bi("4 גורמי סיכון", "4 risk factors") },
  ],
  ask: ["total", "band"],
};
