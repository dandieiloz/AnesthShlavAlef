import type { AdditiveScore } from "../types";
import { bi, opt } from "./_helpers";

/**
 * Child-Turcotte-Pugh score for severity of chronic liver disease. Five
 * parameters scored 1–3 (total 5–15) map to class A / B / C. Miller's
 * Anesthesia 10e, Ch 14 (Hepatic Physiology) / Ch 56 (Anesthesia and the
 * Hepatobiliary System).
 */
export const childpugh: AdditiveScore = {
  id: "childpugh",
  abbrev: "Child-Pugh",
  kind: "additive",
  category: "hepatic",
  name: bi("ציון Child-Pugh", "Child-Pugh score"),
  blurb: bi(
    "דירוג חומרת מחלת כבד כרונית לפי חמישה פרמטרים.",
    "Grades the severity of chronic liver disease across five parameters.",
  ),
  miller: {
    primary: { chapter: 56, title: bi("השתלת איברי בטן", "Abdominal Organ Transplantation") },
    also: [{ chapter: 14, title: bi("פיזיולוגיה של מערכת העיכול והכבד", "Gastrointestinal and Hepatic Physiology") }],
  },
  components: [
    {
      id: "ascites",
      label: bi("מיימת", "Ascites"),
      options: [
        opt(bi("אין", "Absent"), 1),
        opt(bi("קלה / נשלטת בתרופות", "Slight / controlled"), 2),
        opt(bi("בינונית עד קשה", "Moderate to severe"), 3),
      ],
    },
    {
      id: "bilirubin",
      label: bi("בילירובין", "Bilirubin"),
      options: [
        opt(bi("מתחת ל‑2 מ\"ג/ד\"ל", "Under 2 mg/dL"), 1, { min: 0.4, max: 1.9, decimals: 1, unit: "mg/dL" }),
        opt(bi("2–3 מ\"ג/ד\"ל", "2–3 mg/dL"), 2, { min: 2.0, max: 3.0, decimals: 1, unit: "mg/dL" }),
        opt(bi("מעל 3 מ\"ג/ד\"ל", "Over 3 mg/dL"), 3, { min: 3.1, max: 8.0, decimals: 1, unit: "mg/dL" }),
      ],
    },
    {
      id: "albumin",
      label: bi("אלבומין", "Albumin"),
      options: [
        opt(bi("מעל 3.5 ג'/ד\"ל", "Over 3.5 g/dL"), 1, { min: 3.6, max: 5.0, decimals: 1, unit: "g/dL" }),
        opt(bi("2.8–3.5 ג'/ד\"ל", "2.8–3.5 g/dL"), 2, { min: 2.8, max: 3.5, decimals: 1, unit: "g/dL" }),
        opt(bi("מתחת ל‑2.8 ג'/ד\"ל", "Under 2.8 g/dL"), 3, { min: 1.8, max: 2.7, decimals: 1, unit: "g/dL" }),
      ],
    },
    {
      id: "inr",
      label: bi("INR", "INR"),
      options: [
        opt(bi("מתחת ל‑1.7", "Under 1.7"), 1, { min: 0.9, max: 1.6, decimals: 1 }),
        opt(bi("1.7–2.3", "1.7–2.3"), 2, { min: 1.7, max: 2.3, decimals: 1 }),
        opt(bi("מעל 2.3", "Over 2.3"), 3, { min: 2.4, max: 4.0, decimals: 1 }),
      ],
    },
    {
      id: "encephalopathy",
      label: bi("אנצפלופתיה", "Encephalopathy"),
      options: [
        opt(bi("אין", "None"), 1),
        opt(bi("דרגה 1–2", "Grade 1–2"), 2),
        opt(bi("דרגה 3–4", "Grade 3–4"), 3),
      ],
    },
  ],
  interpretation: [
    { min: 5, max: 6, label: bi("Class A", "Class A"), detail: bi("5–6 נקודות", "5–6 points") },
    { min: 7, max: 9, label: bi("Class B", "Class B"), detail: bi("7–9 נקודות", "7–9 points") },
    { min: 10, max: 15, label: bi("Class C", "Class C"), detail: bi("10–15 נקודות", "10–15 points") },
  ],
  ask: ["total", "band"],
};
