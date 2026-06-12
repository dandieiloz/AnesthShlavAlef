import type { AdditiveScore } from "../types";
import { bi, opt } from "./_helpers";

/**
 * Glasgow Coma Scale (GCS) — eye, verbal and motor responses summed to 3–15.
 * Miller's Anesthesia 10e, Ch 62 (Neurosurgical Anesthesia) / Ch 80 (Trauma).
 */
export const gcs: AdditiveScore = {
  id: "gcs",
  abbrev: "GCS",
  kind: "additive",
  category: "neuro",
  name: bi("סולם תרדמת גלזגו (GCS)", "Glasgow Coma Scale"),
  blurb: bi(
    "הערכת רמת ההכרה לפי תגובות עיניים, דיבור ותנועה.",
    "Grades level of consciousness by eye, verbal and motor responses.",
  ),
  miller: {
    primary: { chapter: 62, title: bi("טראומה", "Trauma") },
    also: [{ chapter: 80, title: bi("טיפול נמרץ נוירולוגי", "Neurocritical Care") }],
  },
  components: [
    {
      id: "eye",
      label: bi("פתיחת עיניים", "Eye opening"),
      options: [
        opt(bi("אין", "None"), 1),
        opt(bi("לכאב", "To pain"), 2),
        opt(bi("לדיבור", "To speech"), 3),
        opt(bi("ספונטנית", "Spontaneous"), 4),
      ],
    },
    {
      id: "verbal",
      label: bi("תגובה מילולית", "Verbal response"),
      options: [
        opt(bi("אין", "None"), 1),
        opt(bi("קולות בלתי מובנים", "Incomprehensible sounds"), 2),
        opt(bi("מילים לא הולמות", "Inappropriate words"), 3),
        opt(bi("מבולבל", "Confused"), 4),
        opt(bi("מתמצא", "Oriented"), 5),
      ],
    },
    {
      id: "motor",
      label: bi("תגובה מוטורית", "Motor response"),
      options: [
        opt(bi("אין", "None"), 1),
        opt(bi("יישור (דצרברציה)", "Extension (decerebrate)"), 2),
        opt(bi("כפיפה לא תקינה (דקורטיקציה)", "Abnormal flexion (decorticate)"), 3),
        opt(bi("נסיגה מכאב", "Withdrawal from pain"), 4),
        opt(bi("ממקם כאב", "Localizes pain"), 5),
        opt(bi("מציית לפקודות", "Obeys commands"), 6),
      ],
    },
  ],
  interpretation: [
    { min: 3, max: 8, label: bi("פגיעה קשה", "Severe"), detail: bi("3–8", "3–8") },
    { min: 9, max: 12, label: bi("פגיעה בינונית", "Moderate"), detail: bi("9–12", "9–12") },
    { min: 13, max: 15, label: bi("פגיעה קלה", "Mild"), detail: bi("13–15", "13–15") },
  ],
  ask: ["total", "band"],
};
