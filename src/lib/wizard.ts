import { genai, FLASH_MODEL, sanitizeLatexBackslashes } from "@/lib/gemini";
import { Type } from "@google/genai";

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

export async function parseQuestion(rawText: string): Promise<ParsedQuestion> {
  const userPrompt = [
    "טקסט גולמי של השאלה לקליטה:",
    "",
    rawText,
    "",
    "החזר תוצאה במבנה JSON.",
  ].join("\n");

  const resp = await genai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          stem: { type: Type.STRING, description: "גוף השאלה בלבד, ללא האפשרויות" },
          optionA: { type: Type.STRING, description: "אפשרות א ללא הסימן" },
          optionB: { type: Type.STRING, description: "אפשרות ב ללא הסימן" },
          optionC: { type: Type.STRING, description: "אפשרות ג ללא הסימן" },
          optionD: { type: Type.STRING, description: "אפשרות ד ללא הסימן" },
        },
        required: ["stem", "optionA", "optionB", "optionC", "optionD"],
      },
    },
  });

  const text = resp.text;
  if (!text) throw new Error("Gemini returned empty response");

  try {
    return JSON.parse(sanitizeLatexBackslashes(text)) as ParsedQuestion;
  } catch {
    throw new Error("Failed to parse Gemini JSON response: " + text.slice(0, 200));
  }
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

  const resp = await genai.models.generateContent({
    model: FLASH_MODEL,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
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
              },
              required: ["stem", "optionA", "optionB", "optionC", "optionD"],
            },
          },
        },
        required: ["questions"],
      },
    },
  });

  const text = resp.text;
  if (!text) throw new Error("Gemini returned empty response");

  try {
    const parsed = JSON.parse(sanitizeLatexBackslashes(text)) as { questions: ParsedQuestion[] };
    return parsed.questions ?? [];
  } catch {
    throw new Error("Failed to parse Gemini JSON response: " + text.slice(0, 200));
  }
}

/** @deprecated use parseQuestion — chapter classification removed from wizard */
export const parseAndClassifyQuestion = parseQuestion;
