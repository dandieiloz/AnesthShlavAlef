import type { AdditiveScore } from "../types";
import { bi, triple } from "./_helpers";

/**
 * Apgar score for newborn assessment at 1 and 5 minutes. Five signs scored
 * 0–2 (max 10). Miller's Anesthesia 10e, Ch 72 (Neonatal Resuscitation) /
 * Ch 58 (Obstetric Anesthesia).
 */
export const apgar: AdditiveScore = {
  id: "apgar",
  abbrev: "Apgar",
  kind: "additive",
  category: "obstetric",
  name: bi("ציון Apgar ליילוד", "Apgar score"),
  blurb: bi(
    "הערכת מצב היילוד מיד לאחר הלידה לפי חמישה סימנים.",
    "Assesses the newborn immediately after birth across five signs.",
  ),
  miller: {
    primary: { chapter: 72, title: bi("החייאת יילודים", "Neonatal Resuscitation") },
    also: [{ chapter: 58, title: bi("הרדמה מיילדותית", "Obstetric Anesthesia") }],
  },
  components: [
    triple(
      "appearance",
      bi("מראה (צבע)", "Appearance (color)"),
      bi("כחול או חיוור בכל הגוף", "Blue or pale all over"),
      bi("גוף ורוד, גפיים כחולות", "Body pink, extremities blue (acrocyanosis)"),
      bi("ורוד לחלוטין", "Completely pink"),
    ),
    triple(
      "pulse",
      bi("דופק", "Pulse"),
      bi("אין דופק", "Absent"),
      bi("מתחת ל‑100 לדקה", "Below 100/min"),
      bi("100 לדקה ומעלה", "100/min or above"),
    ),
    triple(
      "grimace",
      bi("רפלקס (Grimace)", "Grimace (reflex irritability)"),
      bi("אין תגובה", "No response"),
      bi("העוויה", "Grimace"),
      bi("בכי, שיעול או התעטשות", "Cry, cough, or sneeze"),
    ),
    triple(
      "activity",
      bi("טונוס שרירים (Activity)", "Activity (muscle tone)"),
      bi("רפוי", "Limp"),
      bi("כפיפה חלקית", "Some flexion"),
      bi("תנועה פעילה", "Active motion"),
    ),
    triple(
      "respiration",
      bi("נשימה", "Respiration"),
      bi("אין נשימה", "Absent"),
      bi("איטית או לא סדירה", "Slow or irregular"),
      bi("בכי חזק", "Good, strong cry"),
    ),
  ],
  interpretation: [
    { min: 0, max: 3, label: bi("דיכוי חמור", "Severely depressed"), detail: bi("0–3", "0–3") },
    { min: 4, max: 6, label: bi("דיכוי בינוני", "Moderately depressed"), detail: bi("4–6", "4–6") },
    { min: 7, max: 10, label: bi("מצב תקין", "Reassuring"), detail: bi("7–10", "7–10") },
  ],
  ask: ["total", "band"],
};
