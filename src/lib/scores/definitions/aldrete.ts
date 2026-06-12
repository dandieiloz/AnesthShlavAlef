import type { AdditiveScore } from "../types";
import { bi, triple } from "./_helpers";

/**
 * Aldrete score for post-anesthesia recovery / readiness for PACU discharge.
 * Five parameters scored 0–2 (max 10); a score ≥ 9 generally indicates
 * readiness for discharge. Miller's Anesthesia 10e, Ch 76 (PACU).
 */
export const aldrete: AdditiveScore = {
  id: "aldrete",
  abbrev: "Aldrete",
  kind: "additive",
  category: "ponvPacu",
  name: bi("ציון Aldrete להתאוששות", "Aldrete recovery score"),
  blurb: bi(
    "הערכת מוכנות לשחרור מחדר ההתאוששות לפי חמישה פרמטרים.",
    "Assesses readiness for discharge from the PACU across five parameters.",
  ),
  miller: {
    primary: { chapter: 76, title: bi("ההתאוששות (PACU)", "The Postanesthesia Care Unit") },
  },
  components: [
    triple(
      "activity",
      bi("פעילות מוטורית", "Activity"),
      bi("אינו מזיז גפיים", "Unable to move extremities"),
      bi("מזיז שתי גפיים", "Moves two extremities"),
      bi("מזיז ארבע גפיים", "Moves four extremities"),
    ),
    triple(
      "respiration",
      bi("נשימה", "Respiration"),
      bi("דום נשימה / זקוק לתמיכה", "Apneic / needs support"),
      bi("קוצר נשימה או נשימה שטחית", "Dyspnea or shallow breathing"),
      bi("נושם עמוק ומשתעל חופשי", "Breathes deeply and coughs freely"),
    ),
    triple(
      "circulation",
      bi("מחזור הדם (שינוי בלחץ הדם)", "Circulation (BP change)"),
      bi("סטייה מעל 50 ממ\"כ מהבסיס", "More than 50 mmHg from baseline"),
      bi("סטייה של 20–50 ממ\"כ", "20–50 mmHg from baseline"),
      bi("סטייה פחות מ‑20 ממ\"כ", "Less than 20 mmHg from baseline"),
    ),
    triple(
      "consciousness",
      bi("הכרה", "Consciousness"),
      bi("אינו מגיב", "Not responding"),
      bi("מתעורר בקריאה", "Arousable on calling"),
      bi("ער לחלוטין", "Fully awake"),
    ),
    triple(
      "oxygen",
      bi("ריווי חמצן", "Oxygen saturation"),
      bi("מתחת ל‑90% גם עם חמצן", "Below 90% even with oxygen"),
      bi("זקוק לחמצן לשמירה מעל 90%", "Needs oxygen to maintain above 90%"),
      bi("מעל 92% באוויר חדר", "Above 92% on room air"),
    ),
  ],
  interpretation: [
    {
      min: 0,
      max: 8,
      label: bi("לא מוכן לשחרור", "Not ready for discharge"),
      detail: bi("ציון מתחת ל‑9", "Score below 9"),
    },
    {
      min: 9,
      max: 10,
      label: bi("מוכן לשחרור", "Ready for discharge"),
      detail: bi("ציון 9 ומעלה", "Score 9 or above"),
    },
  ],
  ask: ["total"],
};
