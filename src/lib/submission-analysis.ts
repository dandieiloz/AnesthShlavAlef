import "server-only";
import { Type, type Schema } from "@google/genai";
import { generateJson, FLASH_MODEL } from "@/lib/gemini";

/**
 * A single question recovered from a raw user submission, normalized into the
 * stem + 4-option shape used by the question bank. `submitterAnswer` is the
 * answer the submitter *claimed* is correct — it is stored only as a hint for
 * admins; the authoritative answer is decided later by the RAG pipeline.
 */
export type StandardizedQuestion = {
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  submitterAnswer: "A" | "B" | "C" | "D" | null;
};

const SYSTEM_PROMPT = [
  "אתה עוזר שמסייע לאדמין לתקנן שאלות אמריקאיות בעברית למאגר שאלות לאנסתזיולוגיה.",
  "המשתמש שלח אוסף גולמי של שאלות יחד עם התשובות שלדעתו הן הנכונות (הטקסט עשוי להגיע מהדבקה או מקובץ).",
  "תפקידך לחלץ כל שאלה בנפרד ולהחזירה במבנה מתוקנן:",
  "1. גוף השאלה (stem).",
  "2. ארבע האפשרויות (א/ב/ג/ד) — רק הטקסט, ללא הסימון (א./ב./ג./ד.) בתחילתה.",
  "3. submitterAnswer — האות (A/B/C/D) של האפשרות שהמשתמש סימן כתשובה הנכונה, אם צוינה.",
  "",
  "הנחיות:",
  "- חלץ את כל השאלות שבטקסט לפי הסדר.",
  "- אל תמציא תשובה: אם המשתמש לא ציין תשובה נכונה לשאלה מסוימת, החזר submitterAnswer = null.",
  "- מפֵּה את התשובה שצוינה (למשל 'התשובה: ב', 'Answer: C', הדגשה או סימון) לאות הלטינית המתאימה: א=A, ב=B, ג=C, ד=D.",
  "- שמור על הטקסט המקורי, כולל סמלי LaTeX (לדוגמה $CMRO_2$).",
  "- התעלם מטקסט שאינו חלק מהשאלות (כותרות, מספור עמודים, הערות).",
  "- אל תוסיף פרשנות, מספרי פרקים, או שדות נוספים מעבר למבנה המבוקש.",
].join("\n");

const SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          stem: { type: Type.STRING, description: "גוף השאלה בלבד, ללא האפשרויות" },
          optionA: { type: Type.STRING, description: "אפשרות א ללא הסימן" },
          optionB: { type: Type.STRING, description: "אפשרות ב ללא הסימן" },
          optionC: { type: Type.STRING, description: "אפשרות ג ללא הסימן" },
          optionD: { type: Type.STRING, description: "אפשרות ד ללא הסימן" },
          submitterAnswer: {
            type: Type.STRING,
            nullable: true,
            description: "האות הלטינית (A/B/C/D) של התשובה שהמשתמש סימן כנכונה, או null אם לא צוינה במפורש",
          },
        },
        required: ["stem", "optionA", "optionB", "optionC", "optionD"],
      },
    },
  },
  required: ["questions"],
};

function normalizeAnswer(v: unknown): "A" | "B" | "C" | "D" | null {
  return v === "A" || v === "B" || v === "C" || v === "D" ? v : null;
}

/**
 * Run a Gemini standardization pass over a raw submission dump.
 * Returns the recovered questions in source order (may be empty).
 */
export async function standardizeSubmission(rawText: string): Promise<StandardizedQuestion[]> {
  const userPrompt = [
    "הטקסט הגולמי הבא מכיל שאלה אחת או יותר עם התשובות שסומנו. תקנן את כולן לפי הסדר:",
    "",
    rawText,
    "",
    "החזר תוצאה במבנה JSON.",
  ].join("\n");

  const parsed = await generateJson<{ questions?: Array<Partial<StandardizedQuestion>> }>(
    FLASH_MODEL,
    SYSTEM_PROMPT,
    userPrompt,
    SCHEMA,
    0.1,
  );

  return (parsed.questions ?? []).map((q) => ({
    stem: (q.stem ?? "").trim(),
    optionA: (q.optionA ?? "").trim(),
    optionB: (q.optionB ?? "").trim(),
    optionC: (q.optionC ?? "").trim(),
    optionD: (q.optionD ?? "").trim(),
    submitterAnswer: normalizeAnswer(q.submitterAnswer),
  }));
}
