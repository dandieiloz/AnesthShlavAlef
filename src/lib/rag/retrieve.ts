import { db } from "@/lib/db";
import { embedText } from "@/lib/gemini";
import type { RetrievedChunk } from "./types";

/**
 * Per-language top-K candidates fetched per embedding. The two result sets
 * (Hebrew + English query) are unioned and deduped before reranking.
 */
const PER_QUERY_K = 30;

type Row = {
  id: number;
  text: string;
  chapterId: number;
  chapterNumber: number;
  chapterTitle: string;
  sectionPath: string | null;
  vectorScore: number;
};

async function annSearch(queryVector: number[], k: number): Promise<Row[]> {
  const vecLiteral = `[${queryVector.join(",")}]`;
  return db.$queryRawUnsafe<Row[]>(
    `SELECT cc.id,
            cc.text,
            cc."chapterId",
            c.number       AS "chapterNumber",
            c.title        AS "chapterTitle",
            cc."sectionPath" AS "sectionPath",
            (cc.embedding <=> $1::vector) AS "vectorScore"
     FROM "ChapterChunk" cc
     JOIN "Chapter" c ON c.id = cc."chapterId"
     WHERE c."ingestedAt" IS NOT NULL
     ORDER BY cc.embedding <=> $1::vector
     LIMIT $2`,
    vecLiteral,
    k,
  );
}

/**
 * Dual-query retrieval: embed the (Hebrew) original AND the (English) translated
 * stem and union the top-K from each. NO chapter filter is applied — evidence
 * may live in any chapter, and the question's tagged chapter is never used as
 * a constraint. The chapter tag is treated as metadata for organization only.
 */
export async function retrieveCandidates(opts: {
  hebrewQuery: string;
  englishQuery: string | null;
  perQueryK?: number;
}): Promise<RetrievedChunk[]> {
  const k = opts.perQueryK ?? PER_QUERY_K;

  const heVec = await embedText(opts.hebrewQuery, "RETRIEVAL_QUERY");
  const hePromise = annSearch(heVec, k);
  let enPromise: Promise<Row[]> | null = null;
  if (opts.englishQuery && opts.englishQuery.trim().length > 0) {
    enPromise = embedText(opts.englishQuery, "RETRIEVAL_QUERY").then((v) => annSearch(v, k));
  }
  const heRows = await hePromise;
  const enRows = enPromise ? await enPromise : [];

  // Dedup by chunk id, keeping the lowest (best) vector score across both queries.
  const merged = new Map<number, RetrievedChunk>();
  for (const r of [...heRows, ...enRows]) {
    const existing = merged.get(r.id);
    if (!existing || r.vectorScore < existing.vectorScore) {
      merged.set(r.id, {
        id: r.id,
        text: r.text,
        chapterId: r.chapterId,
        chapterNumber: r.chapterNumber,
        chapterTitle: r.chapterTitle,
        sectionPath: r.sectionPath,
        vectorScore: r.vectorScore,
      });
    }
  }
  return [...merged.values()].sort((a, b) => a.vectorScore - b.vectorScore);
}
