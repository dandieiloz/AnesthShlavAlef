import type { ClassifyScore } from "../types";
import { bi } from "./_helpers";

/**
 * Echocardiographic grading of aortic stenosis severity (Miller's Anesthesia,
 * Table 33.5). Severity is judged from any of four parameters — peak jet
 * velocity, mean gradient, aortic valve area (AVA), or indexed AVA. Each
 * generated presentation states one parameter value that falls unambiguously in
 * a single severity grade.
 *
 * Mild     — Vmax 2.6–2.9 m/s · mean gradient < 20 mmHg · AVA > 1.5 cm² · indexed AVA > 0.85 cm²/m²
 * Moderate — Vmax 3.0–4.0 m/s · mean gradient 20–40 mmHg · AVA 1.0–1.5 cm² · indexed AVA 0.6–0.85 cm²/m²
 * Severe   — Vmax ≥ 4.0 m/s · mean gradient ≥ 40 mmHg · AVA < 1.0 cm² · indexed AVA < 0.6 cm²/m²
 */
export const aorticstenosis: ClassifyScore = {
  id: "aorticstenosis",
  abbrev: "AS severity",
  kind: "classify",
  category: "cardiacPeriop",
  name: bi("דרגת חומרה של היצרות אבי העורקים", "Aortic stenosis severity"),
  blurb: bi(
    "דירוג חומרת היצרות אבי העורקים לפי מהירות שיא, מפל לחץ ממוצע ושטח המסתם.",
    "Grades aortic stenosis severity by peak velocity, mean gradient, and valve area.",
  ),
  miller: {
    primary: { chapter: 33, title: bi("אקוקרדיוגרפיה סב‑ניתוחית", "Perioperative Echocardiography") },
  },
  categories: [
    {
      id: "mild",
      label: bi("היצרות קלה", "Mild"),
      order: 1,
      presentations: [
        bi("מהירות שיא (Vmax) 2.7 מ'/ש'", "Peak velocity (Vmax) 2.7 m/s"),
        bi("מפל לחץ ממוצע 15 ממ\"כ", "Mean gradient 15 mmHg"),
        bi("שטח מסתם אבי העורקים (AVA) 1.8 סמ\"ר", "Aortic valve area (AVA) 1.8 cm²"),
        bi("שטח מסתם מתוקנן לשטח גוף 0.95 סמ\"ר/מ\"ר", "Indexed AVA 0.95 cm²/m²"),
      ],
      detail: bi(
        "קלה: Vmax 2.6–2.9 מ'/ש' · מפל ממוצע < 20 ממ\"כ · AVA > 1.5 סמ\"ר · AVA מתוקנן > 0.85 סמ\"ר/מ\"ר",
        "Mild: Vmax 2.6–2.9 m/s · mean gradient < 20 mmHg · AVA > 1.5 cm² · indexed AVA > 0.85 cm²/m²",
      ),
    },
    {
      id: "moderate",
      label: bi("היצרות בינונית", "Moderate"),
      order: 2,
      presentations: [
        bi("מהירות שיא (Vmax) 3.5 מ'/ש'", "Peak velocity (Vmax) 3.5 m/s"),
        bi("מפל לחץ ממוצע 30 ממ\"כ", "Mean gradient 30 mmHg"),
        bi("שטח מסתם אבי העורקים (AVA) 1.2 סמ\"ר", "Aortic valve area (AVA) 1.2 cm²"),
        bi("שטח מסתם מתוקנן לשטח גוף 0.7 סמ\"ר/מ\"ר", "Indexed AVA 0.7 cm²/m²"),
      ],
      detail: bi(
        "בינונית: Vmax 3.0–4.0 מ'/ש' · מפל ממוצע 20–40 ממ\"כ · AVA 1.0–1.5 סמ\"ר · AVA מתוקנן 0.6–0.85 סמ\"ר/מ\"ר",
        "Moderate: Vmax 3.0–4.0 m/s · mean gradient 20–40 mmHg · AVA 1.0–1.5 cm² · indexed AVA 0.6–0.85 cm²/m²",
      ),
    },
    {
      id: "severe",
      label: bi("היצרות קשה", "Severe"),
      order: 3,
      presentations: [
        bi("מהירות שיא (Vmax) 4.5 מ'/ש'", "Peak velocity (Vmax) 4.5 m/s"),
        bi("מפל לחץ ממוצע 50 ממ\"כ", "Mean gradient 50 mmHg"),
        bi("שטח מסתם אבי העורקים (AVA) 0.8 סמ\"ר", "Aortic valve area (AVA) 0.8 cm²"),
        bi("שטח מסתם מתוקנן לשטח גוף 0.5 סמ\"ר/מ\"ר", "Indexed AVA 0.5 cm²/m²"),
      ],
      detail: bi(
        "קשה: Vmax ≥ 4.0 מ'/ש' · מפל ממוצע ≥ 40 ממ\"כ · AVA < 1.0 סמ\"ר · AVA מתוקנן < 0.6 סמ\"ר/מ\"ר",
        "Severe: Vmax ≥ 4.0 m/s · mean gradient ≥ 40 mmHg · AVA < 1.0 cm² · indexed AVA < 0.6 cm²/m²",
      ),
    },
  ],
};
