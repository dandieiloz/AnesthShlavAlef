import { FLASH_MODEL, generateText } from "@/lib/gemini";

const SYS = [
  "You translate Hebrew medical-board question stems into precise English for retrieval against an English textbook (Miller's Anesthesia).",
  "Output ONLY the English translation, no preamble, no quotes, no explanation.",
  "Preserve medical terminology, drug names, and LaTeX expressions verbatim.",
  "Do NOT translate the four answer options — only the stem.",
].join("\n");

/**
 * Translate a Hebrew stem to English. Used both at question-creation time
 * (precomputed and stored on Question.stemEn) and as a fallback at retrieval
 * time for legacy questions without a stored translation.
 */
export async function translateStemToEnglish(hebrewStem: string): Promise<string> {
  const trimmed = hebrewStem.trim();
  if (!trimmed) return "";
  // If the text already looks predominantly latin/english, skip the round-trip.
  const hebrewChars = (trimmed.match(/[\u0590-\u05FF]/g) ?? []).length;
  if (hebrewChars < trimmed.length * 0.1) return trimmed;
  const out = await generateText(FLASH_MODEL, SYS, trimmed, 0.1);
  return out.trim();
}
