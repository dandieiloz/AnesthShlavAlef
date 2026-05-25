import { createHash } from "node:crypto";

/**
 * Produce a stable hash of a question's textual content, used as a cache key
 * so that repeated board questions can short-circuit the full RAG pipeline.
 *
 * Normalisation removes whitespace, punctuation, and case so trivially-different
 * phrasings hit the same cache slot. We intentionally include all four options
 * so that questions reusing the same stem with different distractors are NOT
 * collapsed.
 */
export function hashQuestion(parts: {
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
}): string {
  const normalize = (s: string): string =>
    s
      .toLowerCase()
      .replace(/[\s.,\-/'“”‘’?!:;()[\]{}<>|\\@#$%^&*+=~–—]/g, "")
      .normalize("NFKC");
  const joined = [parts.stem, parts.optionA, parts.optionB, parts.optionC, parts.optionD]
    .map(normalize)
    .join("|");
  return createHash("sha256").update(joined).digest("hex");
}
