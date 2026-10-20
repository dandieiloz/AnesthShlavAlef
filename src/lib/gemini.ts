import { GoogleGenAI, type Interactions, type Schema } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && process.env.NODE_ENV !== "test") {
  console.warn("GEMINI_API_KEY not set");
}

export const genai = new GoogleGenAI({ apiKey: apiKey ?? "" });

export const GEN_MODEL = process.env.GEMINI_GENERATION_MODEL ?? "gemini-3.1-pro-preview";
// Cheap model used for: pass-1 generation, query translation, and LLM-as-judge reranking.
export const FLASH_MODEL = process.env.GEMINI_FLASH_MODEL ?? "gemini-3.8-flash";
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

// ── Generation (Interactions API) ──────────────────────────────────────────
// All text/JSON generation goes through `genai.interactions` (generateContent
// is legacy). Per Google's migration notice we never send temperature/top_p/
// top_k or a thinking budget — upcoming models reject them with 400; depth is
// controlled with `thinking_level` only. Embeddings stay on models.embedContent.

export type ThinkingLevel = "minimal" | "low" | "medium" | "high";
export type ImageInput = Interactions.ImageContent;

export type GenerateOptions = {
  /** Omit to use the model default (high for Gemini 3 Pro). */
  thinkingLevel?: ThinkingLevel;
  /** Images sent before the text prompt (e.g. a question's attached figure). */
  images?: ImageInput[];
};

/** Download an image (e.g. a question's attached figure) as inline image input. */
export async function fetchImageInput(url: string): Promise<ImageInput> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed (${res.status}): ${url}`);
  const mimeType = (res.headers.get("content-type")?.split(";")[0] || "image/png") as ImageInput["mime_type"];
  const data = Buffer.from(await res.arrayBuffer()).toString("base64");
  return { type: "image", mime_type: mimeType, data };
}

/**
 * Convert an OpenAPI-style `Schema` (Type.OBJECT, `nullable`) — the format our
 * schemas are written in — to the standard JSON Schema the Interactions API
 * expects (lowercase types, `["x", "null"]` for nullable).
 */
export function toJsonSchema(schema: Schema): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (schema.type) {
    const t = String(schema.type).toLowerCase();
    out.type = schema.nullable ? [t, "null"] : t;
  }
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.required) out.required = schema.required;
  if (schema.items) out.items = toJsonSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([k, v]) => [k, toJsonSchema(v)]),
    );
  }
  return out;
}

async function interact(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  opts: GenerateOptions & { schema?: Schema },
): Promise<string> {
  const images = opts.images ?? [];
  const interaction = await genai.interactions.create({
    model,
    system_instruction: systemInstruction,
    input: images.length ? [...images, { type: "text", text: userPrompt }] : userPrompt,
    // Stateless one-shot calls: don't retain prompts/responses server-side.
    store: false,
    ...(opts.thinkingLevel ? { generation_config: { thinking_level: opts.thinkingLevel } } : {}),
    ...(opts.schema
      ? { response_format: { type: "text", mime_type: "application/json", schema: toJsonSchema(opts.schema) } }
      : {}),
  });
  if (interaction.status !== "completed") {
    throw new Error(`${model} interaction ${interaction.status}`);
  }
  return interaction.output_text ?? "";
}

/** Single-shot generation that returns plain text (no JSON parsing). Used for translation + judging. */
export async function generateText(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  opts: GenerateOptions = {},
): Promise<string> {
  return interact(model, systemInstruction, userPrompt, opts);
}

/** Structured-output generation with a response schema. Caller is responsible for validating the parsed JSON. */
export async function generateJson<T>(
  model: string,
  systemInstruction: string,
  userPrompt: string,
  schema: Schema,
  opts: GenerateOptions = {},
): Promise<T> {
  const raw = await interact(model, systemInstruction, userPrompt, { ...opts, schema });
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
    // `\n`/`\r`/`\t` + uppercase is a real JSON escape before English text
    // ("\nA. Drug…") — no LaTeX command starts that way — so leave it alone.
    .replace(/(?<!\\)\\(?![nrt][A-Z])([a-zA-Z])(?=[a-zA-Z])/g, "\\\\$1")
    // Pass 2: `\X` where X is any other char NOT a valid JSON escape (`"\/bfnrtu`).
    // Lookbehind skips the second `\` of pairs already doubled by pass 1.
    .replace(/(?<!\\)\\([^"\\/bfnrtu])/g, "\\\\$1");
}
