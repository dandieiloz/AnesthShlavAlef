import type { ClassifyScore } from "../types";
import { bi } from "./_helpers";

/**
 * Fisher grading of subarachnoid hemorrhage based on the CT appearance of
 * blood, used to estimate the risk of cerebral vasospasm. Miller's Anesthesia
 * 10e, Ch 53 (Anesthesia for Neurosurgery) / Ch 80 (Trauma).
 */
export const fisher: ClassifyScore = {
  id: "fisher",
  abbrev: "Fisher",
  kind: "classify",
  category: "neuro",
  name: bi("דירוג Fisher בדימום תת‑עכבישי", "Fisher grading of SAH"),
  blurb: bi(
    "דירוג כמות הדם ב‑CT לניבוי סיכון לוזוספזם מוחי.",
    "Grades the amount of blood on CT to predict cerebral vasospasm risk.",
  ),
  miller: {
    primary: { chapter: 53, title: bi("הרדמה בנוירוכירורגיה", "Anesthesia for Neurosurgery") },
    also: [{ chapter: 80, title: bi("טיפול נמרץ נוירולוגי", "Neurocritical Care") }],
  },
  categories: [
    {
      id: "1",
      label: bi("דרגה 1", "Grade 1"),
      order: 1,
      presentations: [
        bi("אין דם נראה ב‑CT", "No blood detected on CT"),
        bi("סריקת CT ללא עדות לדימום", "CT without evidence of hemorrhage"),
      ],
      detail: bi("ללא דם", "No blood"),
    },
    {
      id: "2",
      label: bi("דרגה 2", "Grade 2"),
      order: 2,
      presentations: [
        bi("שכבת דם דקה ומפושטת בעובי מתחת ל‑1 מ\"מ", "Diffuse thin layer of blood under 1 mm thick"),
        bi("דם מפושט דק בציסטרנות", "Diffuse thin blood in the cisterns"),
      ],
      detail: bi("שכבה דקה ומפושטת (< 1 מ\"מ)", "Diffuse thin layer (< 1 mm)"),
    },
    {
      id: "3",
      label: bi("דרגה 3", "Grade 3"),
      order: 3,
      presentations: [
        bi("קריש מקומי או שכבת דם בעובי 1 מ\"מ ומעלה", "Localized clot or layer of blood 1 mm or thicker"),
        bi("קריש סמיך בחריץ או בציסטרנה", "Thick clot in a fissure or cistern"),
      ],
      detail: bi("קריש מקומי או שכבה עבה (≥ 1 מ\"מ)", "Localized clot or thick layer (≥ 1 mm)"),
    },
    {
      id: "4",
      label: bi("דרגה 4", "Grade 4"),
      order: 4,
      presentations: [
        bi("דימום תוך‑מוחי או תוך‑חדרי", "Intracerebral or intraventricular hemorrhage"),
        bi("דם תוך‑חדרי עם דימום תת‑עכבישי מועט או ללא", "Intraventricular blood with little or no SAH"),
      ],
      detail: bi("דימום תוך‑מוחי או תוך‑חדרי", "Intracerebral or intraventricular hemorrhage"),
    },
  ],
};
