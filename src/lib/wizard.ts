import { FLASH_MODEL, generateJson } from "@/lib/gemini";
import { Type, type Schema } from "@google/genai";

/**
 * Question fields extracted from raw pasted text.
 * Chapter assignment is intentionally excluded — it is derived by the
 * RAG pipeline from evidence after the explanation is generated.
 */
export type ParsedQuestion = {
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
};

const SYSTEM_PROMPT = [
  "אתה עוזר שמסייע לאדמין לקלוט שאלות אמריקאיות בעברית למאגר שאלות לאנסתזיולוגיה.",
  "תפקידך לחלץ מהטקסט הגולמי שמועבר אליך:",
  "1. את גוף השאלה.",
  "2. את ארבע התשובות האפשריות (א, ב, ג, ד).",
  "",
  "הנחיות:",
  "- גוף השאלה: כל הטקסט שלפני האפשרויות הממוספרות (א/ב/ג/ד).",
  "- כל אחת מהאפשרויות צריכה להופיע בלי הסימן (א./ב./ג./ד.) בתחילתה - רק הטקסט.",
  "- שמור על הטקסט המקורי, כולל סמלי LaTeX (לדוגמה $CMRO_2$).",
  "- אל תוסיף פרשנות, מספרי פרקים, או כל שדה נוסף מעבר למבנה המבוקש.",
].join("\n");

const QUESTION_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    stem: { type: Type.STRING, description: "גוף השאלה בלבד, ללא האפשרויות" },
    optionA: { type: Type.STRING, description: "אפשרות א ללא הסימן" },
    optionB: { type: Type.STRING, description: "אפשרות ב ללא הסימן" },
    optionC: { type: Type.STRING, description: "אפשרות ג ללא הסימן" },
    optionD: { type: Type.STRING, description: "אפשרות ד ללא הסימן" },
  },
  required: ["stem", "optionA", "optionB", "optionC", "optionD"],
};

export async function parseQuestion(rawText: string): Promise<ParsedQuestion> {
  const userPrompt = [
    "טקסט גולמי של השאלה לקליטה:",
    "",
    rawText,
    "",
    "החזר תוצאה במבנה JSON.",
  ].join("\n");

  return generateJson<ParsedQuestion>(FLASH_MODEL, SYSTEM_PROMPT, userPrompt, QUESTION_SCHEMA);
}

/**
 * Parse every question found in rawText and return them as an array.
 * Handles a single question (returns length-1 array) or a multi-question
 * paste (numbered exam paper, questions separated by blank lines, etc.).
 */
export async function parseMultipleQuestions(rawText: string): Promise<ParsedQuestion[]> {
  const userPrompt = [
    "הטקסט הבא מכיל שאלה אחת או יותר. חלץ את כולן לפי הסדר:",
    "",
    rawText,
    "",
    "החזר תוצאה במבנה JSON.",
  ].join("\n");

  const parsed = await generateJson<{ questions?: ParsedQuestion[] }>(FLASH_MODEL, SYSTEM_PROMPT, userPrompt, {
    type: Type.OBJECT,
    properties: { questions: { type: Type.ARRAY, items: QUESTION_SCHEMA } },
    required: ["questions"],
  });
  return parsed.questions ?? [];
}

/** @deprecated use parseQuestion — chapter classification removed from wizard */
export const parseAndClassifyQuestion = parseQuestion;
