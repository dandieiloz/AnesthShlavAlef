/**
 * Ingest a single chapter PDF with heading-aware chunking (Phase 2 / RAG v2).
 *
 *   npm run ingest -- <chapterNumber> <pathToPdf>
 *
 * Replaces existing chunks for the chapter.
 */
import { db } from "../src/lib/db";
import { embedText } from "../src/lib/gemini";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { extractStructuredChunks, type ExtractedChunk } from "./lib/pdf-extract";

export async function ingestChapter(chapterNumber: number, pdfPath: string): Promise<void> {
  const chapter = await db.chapter.findUnique({ where: { number: chapterNumber } });
  if (!chapter) throw new Error(`Chapter ${chapterNumber} not found. Run db:seed first.`);

  console.log(`[ch${chapterNumber}] reading ${path.basename(pdfPath)} ...`);
  const buf = await readFile(path.resolve(pdfPath));
  // pdfjs-dist expects a Uint8Array; Buffer.from(buf) sometimes shares memory with internal pools.
  const data = new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const chunks = await extractStructuredChunks(data);
  console.log(`[ch${chapterNumber}] extracted ${chunks.length} structured chunks. Embedding...`);

  await db.chapterChunk.deleteMany({ where: { chapterId: chapter.id } });

  let inserted = 0;
  for (const chunk of chunks) {
    const vec = await embedWithRetry(chunk.text, chunkLabel(chunk));
    if (!vec) continue;
    const vecLiteral = `[${vec.join(",")}]`;
    await db.$executeRawUnsafe(
      `INSERT INTO "ChapterChunk"
         ("chapterId","ord","text","embedding","sectionPath","headingLevel","pageStart","pageEnd","tokenCount")
       VALUES ($1,$2,$3,$4::vector,$5,$6,$7,$8,$9)`,
      chapter.id,
      chunk.ord,
      chunk.text,
      vecLiteral,
      chunk.sectionPath,
      chunk.headingLevel,
      chunk.pageStart,
      chunk.pageEnd,
      chunk.tokenCount,
    );
    inserted++;
    if (inserted % 25 === 0) console.log(`[ch${chapterNumber}]   ${inserted}/${chunks.length}`);
  }

  await db.chapter.update({ where: { id: chapter.id }, data: { ingestedAt: new Date() } });
  console.log(`[ch${chapterNumber}] done. ${inserted} chunks stored.`);
}

function chunkLabel(c: ExtractedChunk): string {
  return `[ord=${c.ord} pages=${c.pageStart}-${c.pageEnd} section=${c.sectionPath ?? "(root)"}]`;
}

async function embedWithRetry(text: string, label: string): Promise<number[] | undefined> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await embedText(text, "RETRIEVAL_DOCUMENT");
    } catch (e: unknown) {
      const msg = String(e);
      const retriable =
        msg.includes("503") ||
        msg.includes("UNAVAILABLE") ||
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED");
      if (attempt < 4 && retriable) {
        const delay = 5000 * Math.pow(2, attempt);
        console.warn(`  retry ${label} attempt ${attempt + 1} after ${delay / 1000}s`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        console.warn(`  SKIPPING ${label}: ${msg.slice(0, 120)}`);
        return undefined;
      }
    }
  }
  return undefined;
}

// CLI entry — only runs when invoked directly, not when imported by reingest-all
const isMain = process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]));
if (isMain) {
  const [chapterNumStr, pdfPath] = process.argv.slice(2);
  if (!chapterNumStr || !pdfPath) {
    console.error("Usage: npm run ingest -- <chapterNumber> <pathToPdf>");
    process.exit(1);
  }
  ingestChapter(Number(chapterNumStr), pdfPath)
    .then(() => db.$disconnect())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
