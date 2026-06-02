import type { Choice } from "@prisma/client";

/** A chunk pulled from the vector store, optionally enriched with rerank score. */
export type RetrievedChunk = {
  id: number;
  text: string;
  chapterId: number;
  chapterNumber: number;
  chapterTitle: string;
  sectionPath: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  /** Vector-distance score (lower = closer) from pgvector. */
  vectorScore: number;
  /** 0..10 score from the LLM-judge reranker. Populated after rerank step. */
  rerankScore?: number;
};

export type EvidenceCitation = {
  chapterNumber: number;
  chapterTitle: string;
  sectionPath: string | null;
  quote: string;
  /** PDF page where the quote starts (1-based, optional for legacy rows). */
  pageStart?: number | null;
  /** PDF page where the quote ends. Equal to pageStart when same page. */
  pageEnd?: number | null;
};

/** What the structured-output LLM returns. */
export type StructuredAnswer = {
  translation: string;
  correctAnswer: Choice;
  confidence: number; // 0..1
  evidence: EvidenceCitation[];
  explanation: string;
  whyOthersWrong: { A: string; B: string; C: string; D: string };
  insufficientEvidence: boolean;
};

/** Persisted cache payload — everything needed to reconstitute a GeminiAnswer for a repeated question. */
export type CachedAnswerPayload = {
  rawMarkdown: string;
  structured: StructuredAnswer;
  model: string;
  sourceChapters: number[];
  derivedChapterIds: number[];
  primaryChapterId: number | null; // chapter ID (not number) of the first evidence item
};
