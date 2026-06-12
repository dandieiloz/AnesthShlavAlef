import type { ClassifyScore } from "../types";
import { bi } from "./_helpers";

/**
 * Hunt and Hess grading of subarachnoid hemorrhage (aneurysmal SAH). Five
 * clinical grades; serious systemic disease or severe vasospasm advances the
 * patient one grade. Miller's Anesthesia 10e, Ch 53 (Anesthesia for
 * Neurosurgery) / Ch 80 (Trauma).
 */
export const hunthess: ClassifyScore = {
  id: "hunthess",
  abbrev: "Hunt & Hess",
  kind: "classify",
  category: "neuro",
  name: bi("דירוג Hunt & Hess לדימום תת‑עכבישי", "Hunt & Hess grading of SAH"),
  blurb: bi(
    "דירוג קליני של דימום תת‑עכבישי מפרצתי לפי חומרת התסמינים.",
    "Clinical grading of aneurysmal subarachnoid hemorrhage by symptom severity.",
  ),
  miller: {
    primary: { chapter: 53, title: bi("הרדמה בנוירוכירורגיה", "Anesthesia for Neurosurgery") },
    also: [{ chapter: 80, title: bi("טיפול נמרץ נוירולוגי", "Neurocritical Care") }],
  },
  categories: [
    {
      id: "I",
      label: bi("דרגה I", "Grade I"),
      order: 1,
      presentations: [
        bi("ללא תסמינים", "Asymptomatic"),
        bi("כאב ראש קל בלבד", "Minimal headache only"),
        bi("כאב ראש קל עם נוקשות עורפית קלה", "Slight headache with mild nuchal rigidity"),
      ],
      detail: bi("ללא תסמינים או כאב ראש קל ונוקשות עורפית קלה", "Asymptomatic or minimal headache and slight nuchal rigidity"),
    },
    {
      id: "II",
      label: bi("דרגה II", "Grade II"),
      order: 2,
      presentations: [
        bi("כאב ראש בינוני עד חמור ונוקשות עורפית, ללא חסר נוירולוגי", "Moderate to severe headache and nuchal rigidity, no neurologic deficit"),
        bi("כאב ראש חמור עם שיתוק עצב גולגולתי בלבד", "Severe headache with an isolated cranial nerve palsy"),
        bi("נוקשות עורפית בולטת ללא חסר מוקדי", "Marked nuchal rigidity without focal deficit"),
      ],
      detail: bi(
        "כאב ראש בינוני‑חמור, נוקשות עורפית, ללא חסר נוירולוגי פרט לשיתוק עצב גולגולתי",
        "Moderate to severe headache, nuchal rigidity, no deficit other than cranial nerve palsy",
      ),
    },
    {
      id: "III",
      label: bi("דרגה III", "Grade III"),
      order: 3,
      presentations: [
        bi("ישנוניות ובלבול", "Drowsiness and confusion"),
        bi("בלבול עם חסר מוקדי קל", "Confusion with a mild focal deficit"),
        bi("נמנום עם חולשה קלה בגף", "Lethargy with mild limb weakness"),
      ],
      detail: bi("ישנוניות, בלבול או חסר מוקדי קל", "Drowsiness, confusion, or mild focal deficit"),
    },
    {
      id: "IV",
      label: bi("דרגה IV", "Grade IV"),
      order: 4,
      presentations: [
        bi("טשטוש (stupor) והמיפרזיס בינוני עד חמור", "Stupor and moderate to severe hemiparesis"),
        bi("טשטוש עמוק עם נוקשות דצרברטית מוקדמת", "Deep stupor with early decerebrate rigidity"),
        bi("חוסר תגובה חלקי עם המיפרזיס משמעותי", "Partial responsiveness with significant hemiparesis"),
      ],
      detail: bi(
        "טשטוש, המיפרזיס בינוני‑חמור, ייתכן יישור דצרברטי מוקדם",
        "Stupor, moderate to severe hemiparesis, possibly early decerebrate rigidity",
      ),
    },
    {
      id: "V",
      label: bi("דרגה V", "Grade V"),
      order: 5,
      presentations: [
        bi("תרדמת עמוקה ונוקשות דצרברטית", "Deep coma and decerebrate rigidity"),
        bi("תרדמת עמוקה עם מראה גוסס", "Deep coma with a moribund appearance"),
        bi("חוסר תגובה מוחלט ויישור דצרברטי", "No response with decerebrate posturing"),
      ],
      detail: bi("תרדמת עמוקה, נוקשות דצרברטית, מראה גוסס", "Deep coma, decerebrate rigidity, moribund appearance"),
    },
  ],
  adjust: {
    triggers: [
      { label: bi("יתר לחץ דם חמור", "Severe hypertension"), finding: bi("יתר לחץ דם חמור ברקע", "Background severe hypertension") },
      { label: bi("סוכרת", "Diabetes"), finding: bi("סוכרת ידועה", "Known diabetes mellitus") },
      { label: bi("טרשת עורקים חמורה", "Severe arteriosclerosis"), finding: bi("טרשת עורקים מפושטת חמורה", "Severe diffuse arteriosclerosis") },
      { label: bi("מחלת ריאות כרונית", "Chronic pulmonary disease"), finding: bi("מחלת ריאות חסימתית כרונית", "Chronic obstructive pulmonary disease") },
      { label: bi("וזוספזם חמור", "Severe vasospasm"), finding: bi("וזוספזם חמור בהדמיה", "Severe vasospasm on imaging") },
    ],
    note: bi(
      "מחלה סיסטמית רצינית (יתר לחץ דם, סוכרת, טרשת עורקים חמורה, מחלת ריאות כרונית) או וזוספזם חמור מעלים את המטופל בדרגה אחת.",
      "Serious systemic disease (hypertension, diabetes, severe arteriosclerosis, chronic pulmonary disease) or severe vasospasm advances the patient by one grade.",
    ),
  },
};
