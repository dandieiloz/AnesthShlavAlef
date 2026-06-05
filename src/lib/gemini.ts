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
  thinkingConfig?: { thinkingBudget: number },
): Promise<T> {
  const resp = await genai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction,
      temperature,
      responseMimeType: "application/json",
      responseSchema: schema,
      ...(thinkingConfig ? { thinkingConfig } : {}),
    },
  });
  const raw = resp.text ?? "";
  if (!raw) throw new Error(`${model} returned empty response`);
  const sanitized = sanitizeLatexBackslashes(raw);
  try {
    return JSON.parse(sanitized) as T;
  } catch (e) {
    const msg = (e as Error).message;
    const posMatch = msg.match(/position (\d+)/);
    if (posMatch) {
      const pos = Number(posMatch[1]);
      const start = Math.max(0, pos - 80);
      const end = Math.min(sanitized.length, pos + 80);
      const sanWindow = sanitized.slice(start, end);
      const rawWindow = raw.slice(start, end);
      const hexAtPos = Array.from(sanitized.slice(Math.max(0, pos - 4), Math.min(sanitized.length, pos + 4)))
        .map((c) => `${c}(${c.charCodeAt(0).toString(16)})`)
        .join(" ");
      console.error(
        `[gemini-json] ${model} parse failed at pos ${pos} (sanitized len ${sanitized.length}, raw len ${raw.length}): ${msg}\n` +
          `  hex around pos: ${hexAtPos}\n` +
          `  sanitized[${start}..${end}]: ${JSON.stringify(sanWindow)}\n` +
          `  raw[${start}..${end}]:       ${JSON.stringify(rawWindow)}`,
      );
    }
    throw new Error(`${model} returned non-JSON response: ${msg}\n${raw.slice(0, 500)}`);
  }
}

// Gemini frequently emits LaTeX inside JSON string values with a single backslash,
// which either (a) silently corrupts text via JSON escape collapse (`\text` → TAB+"ext",
// `\beta` → BS+"eta", `\frac` → FF+"rac"), or (b) throws "Bad escaped character" for
// LaTeX spacing/delimiters like `\(`, `\)`, `\,`, `\;`, `\$`, `\!`.
//
// Fix in two passes:
//   1. `\X` where X is a letter that begins a multi-letter run → LaTeX command;
//      double the backslash (handles \text, \beta, \frac, \nabla, \rho, \Delta…).
//   2. `\X` where X is any char NOT a valid JSON escape (`"\/bfnrtu`) → also LaTeX;
//      double the backslash (handles \(, \), \,, \;, \$, \!, \%, \&, \#…).
// Legitimate JSON escapes like `\n"`, `\t,`, `\"`, `\\`, `\u00e9` are untouched.
export function sanitizeLatexBackslashes(raw: string): string {
  return raw
    // Pass 1: `\X` where X is a letter that begins a multi-letter run → LaTeX command.
    // Lookbehind skips the second `\` of legitimate `\\` pairs (e.g. `\\lambda`),
    // which would otherwise be over-doubled into `\\\lambda` and break JSON.parse.
    .replace(/(?<!\\)\\([a-zA-Z])(?=[a-zA-Z])/g, "\\\\$1")
    // Pass 2: `\X` where X is any other char NOT a valid JSON escape (`"\/bfnrtu`).
    // Lookbehind skips the second `\` of pairs already doubled by pass 1.
    .replace(/(?<!\\)\\([^"\\/bfnrtu])/g, "\\\\$1");
}
