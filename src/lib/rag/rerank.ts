import { FLASH_MODEL, generateJson } from "@/lib/gemini";
import { Type } from "@google/genai";
import type { RetrievedChunk } from "./types";

const SYS = [
  "You are a relevance judge for a medical-board RAG system.",
  "Given a question and a set of candidate textbook passages, score how directly each passage helps answer the question on a 0..10 scale.",
  "10 = passage contains the answer or its definitive evidence. 0 = irrelevant.",
  "Be strict: only the most directly evidential passages should score >= 7.",
  "Score each passage independently. Return JSON only.",
].join("\n");

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.INTEGER },
          score: { type: Type.NUMBER },
        },
        required: ["id", "score"],
      },
    },
  },
  required: ["scores"],
};

type JudgeResponse = { scores: Array<{ id: number; score: number }> };

/**
 * Cheap LLM-as-judge reranker. Pass the broad-recall candidate set through
 * gemini-flash, take the top N by score. Vendor-free (no Cohere/Voyage),
 * trivially swappable later.
 */
export async function rerankWithFlashJudge(
  question: string,
  candidates: RetrievedChunk[],
  topN = 10,
): Promise<RetrievedChunk[]> {
  if (candidates.length === 0) return [];
  if (candidates.length <= topN) {
    // Still score them so downstream telemetry is consistent, but cheap-path return.
    return candidates.map((c) => ({ ...c, rerankScore: c.rerankScore ?? 5 }));
  }

  const passages = candidates
    .map(
      (c) =>
        `[id=${c.id}] (Ch ${c.chapterNumber} \u2014 ${c.chapterTitle}${c.sectionPath ? ` > ${c.sectionPath}` : ""})\n${c.text.slice(0, 800)}`,
    )
    .join("\n\n---\n\n");

  const userPrompt = [
    "QUESTION (Hebrew, board format):",
    question,
    "",
    "CANDIDATE PASSAGES:",
    passages,
  ].join("\n");

  let scores: JudgeResponse;
  try {
    scores = await generateJson<JudgeResponse>(FLASH_MODEL, SYS, userPrompt, SCHEMA, 0);
  } catch (e) {
    // If the judge fails, fall back to vector-score ranking so we never block the pipeline.
    console.warn(`Reranker fell back to vector scores: ${(e as Error).message}`);
    return candidates.slice(0, topN);
  }

  const byId = new Map(scores.scores.map((s) => [s.id, s.score]));
  return candidates
    .map((c) => ({ ...c, rerankScore: byId.get(c.id) ?? 0 }))
    .sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0))
    .slice(0, topN);
}
