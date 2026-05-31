/**
 * Sentence-level splitter for AnswerExplanation markdown.
 *
 * Used by the highlight tool to assign each sentence a stable index inside
 * a section, so highlights can persist with anchor (section, sentenceIndex).
 *
 * Splitting rules:
 *  - Markdown is split first by blank-line into "blocks" (paragraphs / list
 *    items / headings). Each non-empty block produces ≥1 sentence.
 *  - Inside a block, sentences are split on `. ! ? ; :` (Latin) and the
 *    Hebrew sof-pasuq-ish forms followed by whitespace.
 *  - KaTeX inline math (`$...$`), display math (`$$...$$`) and inline code
 *    (`` `...` ``) are kept atomic — never split inside.
 *  - Markdown list bullets (`- `, `* `, `1. `) and heading markers (`# ... `)
 *    are preserved on the FIRST sentence of the block so re-rendering it
 *    standalone still renders as a list/heading.
 *  - Empty / whitespace-only sentences are dropped.
 *
 * The returned array preserves source order. Indices are stable as long as
 * the source text is unchanged. `hashSentence` lets callers detect drift.
 */

import { ensureMathDelimiters } from "@/lib/math-delimit";

const HE_TERMINATORS = ".!?;:";
// Match a sentence terminator followed by whitespace OR end-of-string,
// while staying outside `...$`, `$$...$$`, and `` `...` `` spans.
// We do this in two passes: first mask atomic spans, then split, then restore.

const ATOMIC_RE = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|`[^`\n]+?`)/g;

function maskAtomic(text: string): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  const masked = text.replace(ATOMIC_RE, (m) => {
    tokens.push(m);
    return `\u0000${tokens.length - 1}\u0000`;
  });
  return { masked, tokens };
}

function unmaskAtomic(text: string, tokens: string[]): string {
  return text.replace(/\u0000(\d+)\u0000/g, (_, i) => tokens[Number(i)] ?? "");
}

const TERMINATOR_RE = new RegExp(`([${HE_TERMINATORS}])(\\s+|$)`, "g");

function splitBlockIntoSentences(block: string): string[] {
  const { masked, tokens } = maskAtomic(block);

  // Detect leading markdown marker so we can re-attach it to the first sentence
  const headingMatch = masked.match(/^(\s*#{1,6}\s+)/);
  const listMatch = masked.match(/^(\s*(?:[-*+]|\d+\.)\s+)/);
  const prefix = headingMatch?.[1] ?? listMatch?.[1] ?? "";
  const body = masked.slice(prefix.length);

  // Inject a unique separator after each terminator, then split.
  const SEP = "\u0001";
  const injected = body.replace(TERMINATOR_RE, (_, term, ws) => `${term}${SEP}${ws}`);
  const rawParts = injected.split(SEP);

  const sentences: string[] = [];
  for (let i = 0; i < rawParts.length; i++) {
    const piece = rawParts[i].trim();
    if (!piece) continue;
    const restored = unmaskAtomic(piece, tokens);
    sentences.push(i === 0 && prefix ? prefix.trimStart() + restored : restored);
  }

  // If the block produced no sentences (e.g. only the prefix), return whole block
  if (sentences.length === 0) {
    const whole = unmaskAtomic(masked, tokens).trim();
    return whole ? [whole] : [];
  }
  return sentences;
}

/**
 * Split markdown into an ordered array of sentences. Blank lines separate
 * paragraphs; each non-empty paragraph contributes one or more sentences.
 */
export function splitSentences(markdown: string): string[] {
  if (!markdown) return [];
  const normalized = ensureMathDelimiters(markdown);
  const blocks = normalized.split(/\n\s*\n/);
  const out: string[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    out.push(...splitBlockIntoSentences(trimmed));
  }
  return out;
}

/**
 * Stable short hash of a sentence's normalized text. Used to detect when the
 * underlying explanation was edited (e.g. by an admin) and a previously saved
 * highlight no longer matches the sentence at its stored index.
 */
export function hashSentence(sentence: string): string {
  const normalized = sentence.replace(/\s+/g, " ").trim().toLowerCase();
  // FNV-1a 32-bit, repeated twice for 64-bit-ish output (16 hex chars).
  // Avoids requiring Node's crypto in client bundles.
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + 0x9e37;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return hex(h1) + hex(h2);
}
