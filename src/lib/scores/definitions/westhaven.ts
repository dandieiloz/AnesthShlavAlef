import type { ClassifyScore } from "../types";
import { bi } from "./_helpers";

/**
 * West Haven criteria for grading hepatic encephalopathy. Four grades from
 * trivial lack of awareness (I) to coma (IV). Miller's Anesthesia 10e, Ch 14
 * (Hepatic Physiology) / Ch 56 (Anesthesia and the Hepatobiliary System).
 */
export const westhaven: ClassifyScore = {
  id: "westhaven",
  abbrev: "West Haven",
  kind: "classify",
  category: "hepatic",
  name: bi("קריטריוני West Haven לאנצפלופתיה כבדית", "West Haven criteria for hepatic encephalopathy"),
  blurb: bi(
    "דירוג חומרת אנצפלופתיה כבדית לפי מצב הכרה והתנהגות.",
    "Grades hepatic encephalopathy severity by mental state and behavior.",
  ),
  miller: {
    primary: { chapter: 56, title: bi("השתלת איברי בטן", "Abdominal Organ Transplantation") },
    also: [{ chapter: 14, title: bi("פיזיולוגיה של מערכת העיכול והכבד", "Gastrointestinal and Hepatic Physiology") }],
  },
  categories: [
    {
      id: "I",
      label: bi("דרגה I", "Grade I"),
      order: 1,
      presentations: [
        bi("חוסר מודעות קל, ריכוז מקוצר", "Trivial lack of awareness, shortened attention span"),
        bi("אופוריה או חרדה קלה", "Mild euphoria or anxiety"),
        bi("שינוי קל בקצב שינה‑ערות", "Mild change in sleep-wake rhythm"),
      ],
      detail: bi("חוסר מודעות קל, אופוריה/חרדה, ריכוז מקוצר", "Trivial lack of awareness, euphoria/anxiety, short attention span"),
    },
    {
      id: "II",
      label: bi("דרגה II", "Grade II"),
      order: 2,
      presentations: [
        bi("נמנום או אדישות עם חוסר התמצאות בזמן", "Lethargy or apathy with disorientation to time"),
        bi("שינוי אישיות בולט והתנהגות לא הולמת", "Obvious personality change and inappropriate behavior"),
        bi("אסטריקסיס בולט עם בלבול קל", "Marked asterixis with mild confusion"),
      ],
      detail: bi("נמנום/אדישות, חוסר התמצאות בזמן, שינוי אישיות", "Lethargy/apathy, disorientation to time, personality change"),
    },
    {
      id: "III",
      label: bi("דרגה III", "Grade III"),
      order: 3,
      presentations: [
        bi("ישנוניות עד טשטוש אך מגיב לגירוי", "Somnolence to semistupor but responsive to stimuli"),
        bi("חוסר התמצאות גס ובלבול ניכר", "Gross disorientation and marked confusion"),
        bi("דיבור לא ברור עם תגובתיות מופחתת", "Incoherent speech with reduced responsiveness"),
      ],
      detail: bi("ישנוניות עד טשטוש, חוסר התמצאות גס, מגיב לגירוי", "Somnolence to stupor, gross disorientation, responsive to stimuli"),
    },
    {
      id: "IV",
      label: bi("דרגה IV", "Grade IV"),
      order: 4,
      presentations: [
        bi("תרדמת ללא תגובה לגירוי", "Coma, unresponsive to stimuli"),
        bi("תרדמת עמוקה", "Deep coma"),
      ],
      detail: bi("תרדמת", "Coma"),
    },
  ],
};
