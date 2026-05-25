/**
 * Heading-aware PDF extraction using pdfjs-dist.
 *
 * Returns a sequence of text "blocks", each with:
 *   - text             — the concatenated string
 *   - page             — 1-based page number
 *   - fontSize         — dominant font size in the block
 *   - isHeading        — true if fontSize > body * HEADING_RATIO
 *   - headingLevel     — 1..3 if isHeading, else undefined
 *
 * Then groups blocks into chunks of ~CHUNK_SIZE characters, attaching:
 *   - sectionPath      — breadcrumb of active H1 > H2 > H3 headings
 *   - headingLevel     — deepest active heading level (1..3) or null
 *   - pageStart/End    — min/max page numbers spanned by the chunk
 *   - tokenCount       — rough estimate (words * 1.3)
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;
const HEADING_RATIO = 1.15; // font must be > body * ratio to be a heading
const MAX_HEADING_LEVELS = 3;
const MIN_CHUNK_LEN = 50;

export interface ExtractedChunk {
  ord: number;
  text: string;
  sectionPath: string | null;
  headingLevel: number | null;
  pageStart: number;
  pageEnd: number;
  tokenCount: number;
}

interface RawItem {
  text: string;
  fontSize: number;
  page: number;
}

interface Block {
  text: string;
  fontSize: number;
  page: number;
  isHeading: boolean;
  headingLevel?: number;
}

export async function extractStructuredChunks(pdfData: Uint8Array): Promise<ExtractedChunk[]> {
  const loadingTask = getDocument({
    data: pdfData,
    // suppress noisy warnings from pdfjs in Node
    verbosity: 0,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;

  // Pass 1: collect raw text items grouped into visual "lines" per page
  const rawItems: RawItem[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    // Group items by approximate y-coordinate into lines
    type Item = { str: string; size: number; y: number; x: number };
    const items: Item[] = [];
    for (const it of content.items as unknown as { str: string; transform: number[] }[]) {
      if (!it.str || !it.str.trim()) continue;
      const size = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10;
      items.push({ str: it.str, size, y: it.transform[5], x: it.transform[4] });
    }
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    // bucket by y (within 2pt)
    const lines: Item[][] = [];
    for (const it of items) {
      const last = lines[lines.length - 1];
      if (last && Math.abs(last[0].y - it.y) <= 2) {
        last.push(it);
      } else {
        lines.push([it]);
      }
    }
    for (const line of lines) {
      const text = line.map((i) => i.str).join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      // dominant font size = max size in the line (headings often have a few small chars)
      const size = Math.max(...line.map((i) => i.size));
      rawItems.push({ text, fontSize: Math.round(size * 10) / 10, page: pageNum });
    }
    page.cleanup();
  }

  if (rawItems.length === 0) return [];

  // Determine body font size = mode of font sizes weighted by text length
  const weights = new Map<number, number>();
  for (const r of rawItems) {
    weights.set(r.fontSize, (weights.get(r.fontSize) ?? 0) + r.text.length);
  }
  let bodySize = rawItems[0].fontSize;
  let best = 0;
  for (const [size, w] of weights) {
    if (w > best) {
      best = w;
      bodySize = size;
    }
  }

  // Rank heading sizes (sizes > body * HEADING_RATIO) descending → H1, H2, H3
  const headingSizes = [...weights.keys()]
    .filter((s) => s > bodySize * HEADING_RATIO)
    .sort((a, b) => b - a)
    .slice(0, MAX_HEADING_LEVELS);
  const sizeToLevel = new Map(headingSizes.map((s, i) => [s, i + 1]));

  // Pass 2: convert raw items into blocks (heading or body)
  const blocks: Block[] = rawItems.map((r) => {
    const level = sizeToLevel.get(r.fontSize);
    return {
      text: r.text,
      fontSize: r.fontSize,
      page: r.page,
      isHeading: level !== undefined,
      headingLevel: level,
    };
  });

  // Pass 3: walk blocks, maintain section stack, emit chunks
  const chunks: ExtractedChunk[] = [];
  const sectionStack: (string | undefined)[] = new Array(MAX_HEADING_LEVELS).fill(undefined);
  let buf: string[] = [];
  let bufLen = 0;
  let bufPageStart = 0;
  let bufPageEnd = 0;
  let bufHeadingLevel: number | null = null;

  const currentSectionPath = (): string | null => {
    const parts = sectionStack.filter((s): s is string => !!s);
    return parts.length > 0 ? parts.join(" > ") : null;
  };

  const currentHeadingLevel = (): number | null => {
    for (let i = sectionStack.length - 1; i >= 0; i--) {
      if (sectionStack[i]) return i + 1;
    }
    return null;
  };

  const flushChunk = (carryOverlap: boolean) => {
    const text = buf.join(" ").replace(/\s+/g, " ").trim();
    if (text.length >= MIN_CHUNK_LEN) {
      const words = text.split(/\s+/).length;
      chunks.push({
        ord: chunks.length,
        text,
        sectionPath: currentSectionPath(),
        headingLevel: bufHeadingLevel,
        pageStart: bufPageStart || 1,
        pageEnd: bufPageEnd || bufPageStart || 1,
        tokenCount: Math.ceil(words * 1.3),
      });
    }
    if (carryOverlap && text.length > CHUNK_OVERLAP) {
      const tail = text.slice(-CHUNK_OVERLAP);
      buf = [tail];
      bufLen = tail.length;
    } else {
      buf = [];
      bufLen = 0;
    }
    bufPageStart = 0;
    bufPageEnd = 0;
    bufHeadingLevel = currentHeadingLevel();
  };

  for (const b of blocks) {
    if (b.isHeading && b.headingLevel !== undefined) {
      // boundary: flush current chunk (no overlap across section boundaries)
      if (bufLen > 0) flushChunk(false);
      // update stack: set this level, clear deeper levels
      sectionStack[b.headingLevel - 1] = b.text;
      for (let i = b.headingLevel; i < MAX_HEADING_LEVELS; i++) {
        sectionStack[i] = undefined;
      }
      bufHeadingLevel = b.headingLevel;
      // include heading text in the next chunk for retrieval context
      buf.push(b.text);
      bufLen += b.text.length;
      if (bufPageStart === 0) bufPageStart = b.page;
      bufPageEnd = b.page;
    } else {
      if (bufPageStart === 0) bufPageStart = b.page;
      bufPageEnd = b.page;
      buf.push(b.text);
      bufLen += b.text.length + 1;
      if (bufLen >= CHUNK_SIZE) flushChunk(true);
    }
  }
  if (bufLen > 0) flushChunk(false);

  return chunks;
}
