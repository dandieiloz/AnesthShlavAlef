import { GoogleGenAI, type Schema } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("GEMINI_API_KEY not set");
}

export const genai = new GoogleGenAI({ apiKey: apiKey ?? "" });

export const GEN_MODEL = process.env.GEMINI_GENERATION_MODEL ?? "gemini-2.5-pro";
// Cheap model used for: pass-1 generation, query translation, and LLM-as-judge reranking.
export const FLASH_MODEL = process.env.GEMINI_FLASH_MODEL ?? "gemini-2.5-flash";
export const EMBED_MODEL = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
export const EMBED_DIM = 1536;

export async function embedText(text: string, taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[]> {
  const resp = await genai.models.embedContent({
    model: EMBED_MODEL,
    contents: text,
    config: { taskType, outputDimensionality: EMBED_DIM },
  });
  const values = resp.embeddings?.[0]?.values;
  if (!values) throw new Error("Embedding returned no values");
  return values;
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const out: number[][] = [];
  for (const t of texts) out.push(await embedText(t, "RETRIEVAL_DOCUMENT"));
  return out;
}

/** Single-shot generation that returns plain text (no JSON parsing). Used for translation + judging. */
export async function generateText(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  temperature = 0.1,
): Promise<string> {
  const resp = await genai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: { systemInstruction, temperature },
  });
  return resp.text ?? "";
}

/** Structured-output generation with a response schema. Caller is responsible for validating the parsed JSON. */
export async function generateJson<T>(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  schema: Schema,
  temperature = 0.2,
): Promise<T> {
  const resp = await genai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction,
      temperature,
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
  const raw = resp.text ?? "";
  if (!raw) throw new Error(`${model} returned empty response`);
  try {
    return JSON.parse(sanitizeLatexBackslashes(raw)) as T;
  } catch (e) {
    throw new Error(`${model} returned non-JSON response: ${(e as Error).message}\n${raw.slice(0, 500)}`);
  }
}

// Gemini frequently emits LaTeX (e.g. \text, \times, \Delta, \frac) with a single
// backslash inside JSON string values. JSON.parse would then interpret \t / \b /
// \f / \n / \r as control characters and silently drop the backslash, corrupting
// downstream KaTeX rendering. A backslash followed by a letter that is part of a
// letter run can only be a LaTeX command — never a real JSON escape — so we
// double the backslash. Leaves legitimate escapes like \n", \t", \" untouched.
export function sanitizeLatexBackslashes(raw: string): string {
  return raw.replace(/\\([a-zA-Z])(?=[a-zA-Z])/g, "\\\\$1");
}
