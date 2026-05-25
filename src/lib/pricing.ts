/**
 * Gemini API cost estimation for the RAG answer-generation pipeline.
 *
 * Prices are per 1,000,000 tokens (USD). They are stored as constants here
 * and can be overridden via environment variables for recalibration.
 *
 * Pipeline per non-cached question (mirrors src/lib/rag/answer.ts):
 *   1. Embed Hebrew query         — gemini-embedding-001
 *   2. Translate stem → English   — gemini-2.5-flash  (skipped when stemEn exists)
 *   3. Embed English query        — gemini-embedding-001
 *   4. Flash judge rerank         — gemini-2.5-flash  (PER_QUERY_K candidates × ~800 chars)
 *   5. Pass-1 generation (flash)  — gemini-2.5-flash  (TOP_K_PASS1 chunks × AVG_CHUNK_CHARS)
 *   6. Escalation (prob ~30%)     — re-rerank + gemini-2.5-pro  (TOP_K_PASS2 chunks)
 *
 * Accuracy: ±25% due to Hebrew tokenisation heuristic and variable chunk sizes.
 */

// ─── Pipeline constants (mirrors src/lib/rag/answer.ts constants) ────────────
export const TOP_K_PASS1 = 10;
export const TOP_K_PASS2 = 15;
export const PER_QUERY_K = 30;
export const RERANK_CHUNK_CHARS = 800;  // truncation applied in rerank.ts
export const AVG_CHUNK_CHARS = 1800;    // CHUNK_SIZE from scripts/lib/pdf-extract.ts
export const SYSTEM_PROMPT_TOKENS = 300; // rough estimate of system prompt token count

/** Default escalation probability — override via COST_ESCALATION_PROB env var. */
export const ESCALATION_PROB =
  typeof process !== "undefined"
    ? parseFloat(process.env.COST_ESCALATION_PROB ?? "0.30")
    : 0.30;

/** Spending threshold (USD) above which a confirmation dialog is shown. */
export const COST_CONFIRM_THRESHOLD =
  typeof process !== "undefined"
    ? parseFloat(process.env.COST_CONFIRM_THRESHOLD ?? "0.50")
    : 0.50;

// ─── Pricing table: USD per 1,000,000 tokens ─────────────────────────────────
// Source: https://ai.google.dev/pricing (list prices, May 2025).
// Override individual prices via env vars for custom billing agreements.
export const MODEL_PRICES: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gemini-embedding-001": {
    inputPer1M:
      typeof process !== "undefined"
        ? parseFloat(process.env.PRICE_EMBED_IN ?? "0.15")
        : 0.15,
    outputPer1M: 0,
  },
  "gemini-2.5-flash": {
    inputPer1M:
      typeof process !== "undefined"
        ? parseFloat(process.env.PRICE_FLASH_IN ?? "0.30")
        : 0.30,
    outputPer1M:
      typeof process !== "undefined"
        ? parseFloat(process.env.PRICE_FLASH_OUT ?? "2.50")
        : 2.50,
  },
  "gemini-2.5-pro": {
    inputPer1M:
      typeof process !== "undefined"
        ? parseFloat(process.env.PRICE_PRO_IN ?? "1.25")
        : 1.25,
    outputPer1M:
      typeof process !== "undefined"
        ? parseFloat(process.env.PRICE_PRO_OUT ?? "10.00")
        : 10.00,
  },
};

// ─── Token estimation ─────────────────────────────────────────────────────────

/** Fraction of Hebrew Unicode code points (U+0590–U+05FF) in the string. */
function hebrewRatio(text: string): number {
  if (text.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    if (cp >= 0x0590 && cp <= 0x05ff) count++;
  }
  return count / text.length;
}

/**
 * Approximate token count using a character-ratio heuristic.
 * Hebrew/Arabic scripts tokenise at ~2.2 chars/token; Latin at ~4 chars/token.
 * Blends the ratio linearly. Error ±25%.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const hr = hebrewRatio(text);
  const charsPerToken = hr > 0.3 ? 2.2 : 4;
  return Math.ceil(text.length / charsPerToken);
}

function tokenCost(model: string, inputTokens: number, outputTokens: number): number {
  const prices = MODEL_PRICES[model];
  if (!prices) return 0;
  return (inputTokens * prices.inputPer1M + outputTokens * prices.outputPer1M) / 1_000_000;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type StageBreakdown = {
  embedHe: number;
  translate: number;
  embedEn: number;
  rerank: number;
  flashGen: number;
  escalation: number;
};

export type JobCostEstimate = {
  totalUsd: number;
  cached: boolean;
  byStage: StageBreakdown;
};

const ZERO_STAGES: StageBreakdown = {
  embedHe: 0,
  translate: 0,
  embedEn: 0,
  rerank: 0,
  flashGen: 0,
  escalation: 0,
};

// ─── Per-job estimation ───────────────────────────────────────────────────────

export function estimateJobCost(opts: {
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  /** Whether the question already has an English translation stored. */
  hasStemEn: boolean;
  /** Whether there is a matching entry in QuestionQueryCache (cost ≈ $0). */
  cached: boolean;
  /** Override escalation probability (0–1). Defaults to ESCALATION_PROB. */
  escalationProb?: number;
}): JobCostEstimate {
  if (opts.cached) {
    return { totalUsd: 0, cached: true, byStage: { ...ZERO_STAGES } };
  }

  const ep = opts.escalationProb ?? ESCALATION_PROB;
  const EMBED_MODEL = "gemini-embedding-001";
  const FLASH_MODEL = "gemini-2.5-flash";
  const PRO_MODEL = "gemini-2.5-pro";

  const questionText = [
    opts.stem,
    `א. ${opts.optionA}`,
    `ב. ${opts.optionB}`,
    `ג. ${opts.optionC}`,
    `ד. ${opts.optionD}`,
  ].join(" ");
  const qTokens = estimateTokens(questionText);

  // 1. Embed Hebrew query
  const embedHe = tokenCost(EMBED_MODEL, qTokens, 0);

  // 2. Translate stem → English (only when stemEn not already stored)
  //    Rough prompt: small system (50 tok) + Hebrew stem. Output: ~30 tokens English.
  const translate = opts.hasStemEn
    ? 0
    : tokenCost(FLASH_MODEL, 50 + qTokens, 30);

  // 3. Embed English query (English text is ~40% shorter than Hebrew for the same content)
  const embedEn = tokenCost(EMBED_MODEL, Math.ceil(qTokens * 0.6), 0);

  // 4. Rerank: flash judge sees question + PER_QUERY_K candidates × 800 chars each
  //    Candidate text is predominantly English (textbook), ~4 chars/token.
  const rerankCandidateTokens = Math.ceil((PER_QUERY_K * RERANK_CHUNK_CHARS) / 4);
  const rerankInputTokens = qTokens + rerankCandidateTokens;
  const rerankOutputTokens = Math.ceil((PER_QUERY_K * 12) / 4); // JSON scores array
  const rerank = tokenCost(FLASH_MODEL, rerankInputTokens, rerankOutputTokens);

  // 5. Pass-1 generation (flash)
  //    Input: system prompt + question + TOP_K_PASS1 chunks (English textbook, ~4 ch/tok)
  //    Output: structured JSON answer in Hebrew, ~600 tokens
  const flashGenInput =
    SYSTEM_PROMPT_TOKENS + qTokens + Math.ceil((TOP_K_PASS1 * AVG_CHUNK_CHARS) / 4);
  const flashGenOutput = 600;
  const flashGen = tokenCost(FLASH_MODEL, flashGenInput, flashGenOutput);

  // 6. Escalation path (probabilistic)
  //    Re-retrieve + re-rerank with a slightly wider window, then pro generation.
  const escRerankInputTokens =
    qTokens + Math.ceil(((PER_QUERY_K + 10) * RERANK_CHUNK_CHARS) / 4);
  const proGenInput =
    SYSTEM_PROMPT_TOKENS + qTokens + Math.ceil((TOP_K_PASS2 * AVG_CHUNK_CHARS) / 4);
  const proGenOutput = 700;
  const escalationFull =
    tokenCost(FLASH_MODEL, escRerankInputTokens, rerankOutputTokens) + // re-rerank
    tokenCost(PRO_MODEL, proGenInput, proGenOutput); // pro generation
  const escalation = ep * escalationFull;

  const byStage: StageBreakdown = {
    embedHe,
    translate,
    embedEn,
    rerank,
    flashGen,
    escalation,
  };
  const totalUsd = embedHe + translate + embedEn + rerank + flashGen + escalation;

  return { totalUsd, cached: false, byStage };
}

// ─── Batch helper ─────────────────────────────────────────────────────────────

export type BatchCostEstimate = {
  totalUsd: number;
  cachedCount: number;
  jobCount: number;
  escalationPct: number;
  byStage: StageBreakdown;
};

export function estimateBatchCost(
  jobs: Array<{ estimate: JobCostEstimate }>,
  escalationProb = ESCALATION_PROB,
): BatchCostEstimate {
  const byStage: StageBreakdown = { ...ZERO_STAGES };
  let totalUsd = 0;
  let cachedCount = 0;

  for (const { estimate } of jobs) {
    totalUsd += estimate.totalUsd;
    if (estimate.cached) cachedCount++;
    for (const key of Object.keys(ZERO_STAGES) as (keyof StageBreakdown)[]) {
      byStage[key] += estimate.byStage[key];
    }
  }

  return {
    totalUsd,
    cachedCount,
    jobCount: jobs.length,
    escalationPct: Math.round(escalationProb * 100),
    byStage,
  };
}
