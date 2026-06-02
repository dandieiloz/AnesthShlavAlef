/**
 * Heading-, column-, and section-aware PDF extraction using pdfjs-dist.
 *
 * Pipeline:
 *   1. Per page: read pdfjs items, drop running headers/footers, footnote
 *      superscripts, watermarks, and tiny ornaments.
 *   2. Bucket items into visual lines by Y, then split each line into
 *      left-column / right-column / full-width pieces using a midX partition.
 *   3. Emit lines in true reading order (left top→bottom, then right
 *      top→bottom, with full-width lines as flush boundaries).
 *   4. Classify lines as headings (font-size > body * HEADING_RATIO) or body.
 *      Special-case "KEY POINTS" so it always becomes a heading.
 *   5. Walk blocks, maintaining an H1>H2>H3 section stack. Skip everything
 *      under the chapter "References" section. Skip figure/table captions.
 *   6. Accumulate body lines, de-hyphenate across line + page breaks, and
 *      cut chunks at sentence boundaries near CHUNK_SIZE with sentence-aligned
 *      overlap.
 *
 * Each chunk carries: sectionPath breadcrumb, deepest heading level,
 * pageStart/End, rough tokenCount, and clean text.
 */

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;
const HEADING_RATIO = 1.15;
const MAX_HEADING_LEVELS = 3;
const MIN_CHUNK_LEN = 50;

const Y_BUCKET_TOL = 2;
const COL_EDGE_TOL = 12;
const HEADER_FOOTER_BAND = 50;
const FOOTNOTE_SIZE_GAP = 1.5;
const CAPTION_SIZE_GAP = 0.6; // captions are typically ≥0.6pt smaller than body

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

interface PdfItem {
  str: string;
  size: number;
  x: number;
  y: number;
  width: number;
}

type LineKind = "left" | "right" | "full";

interface PageLine {
  text: string;
  size: number;
  y: number;
  kind: LineKind;
}

// ---------- text cleanup ----------

const LIGATURE_MAP: Record<string, string> = {
  "\uFB00": "ff",
  "\uFB01": "fi",
  "\uFB02": "fl",
  "\uFB03": "ffi",
  "\uFB04": "ffl",
  "\uFB05": "ft",
  "\uFB06": "st",
};

/**
 * Replace common PDF text artifacts:
 *   - Unicode ligature codepoints → expanded letters.
 *   - Private-Use Area glyphs (U+E000–U+F8FF) → "•" (most often a bullet
 *     marker that lost its CMap during PDF embedding).
 *   - C0/C1 control chars → removed.
 *   - U+144F and a few other lookalike "syllabic-bullet" mojibakes → "•".
 */
function normalizeText(s: string): string {
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    const lig = LIGATURE_MAP[ch];
    if (lig) {
      out += lig;
      continue;
    }
    // Private use area → bullet
    if (cp >= 0xe000 && cp <= 0xf8ff) {
      out += "•";
      continue;
    }
    // Known undecoded "bullet" glyphs the PDFs use
    if (cp === 0x144f || cp === 0x25cf || cp === 0x25aa || cp === 0x2043) {
      out += "•";
      continue;
    }
    // Control chars (keep \t \n \r)
    if (
      (cp >= 0x0001 && cp <= 0x0008) ||
      (cp >= 0x000b && cp <= 0x001f && cp !== 0x000a && cp !== 0x000d) ||
      (cp >= 0x007f && cp <= 0x009f)
    ) {
      continue;
    }
    out += ch;
  }
  return out;
}

// ---------- line construction ----------

function buildLineText(items: PdfItem[]): string {
  if (items.length === 0) return "";
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let out = sorted[0].str;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    const gap = cur.x - (prev.x + prev.width);
    const prevEndsSpace = /\s$/.test(prev.str);
    const curStartsSpace = /^\s/.test(cur.str);
    if (!prevEndsSpace && !curStartsSpace && gap > 1) {
      out += " ";
    }
    out += cur.str;
  }
  return normalizeText(out).replace(/\s+/g, " ").trim();
}

function maxSize(items: PdfItem[]): number {
  let m = 0;
  for (const it of items) if (it.size > m) m = it.size;
  return m;
}

// ---------- header/footer + caption filters ----------

function looksLikeRunningHeadFoot(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^\d+$/.test(t)) return true;
  if (/Downloaded for|Copyright|rights reserved|For personal use only|ClinicalKey/i.test(t)) return true;
  if (t.length > 80) return false;
  if (/^\d+\s*[•·\-–—]\s*\S/.test(t) && t.length < 60) return true;
  if (/^[A-Z][A-Za-z]{2,}(\s+[A-Za-z]+){0,4}$/.test(t) && t.length < 40) return true;
  if (/^(Section|Chapter|Part)\s+[IVX0-9]+/i.test(t) && t.length < 60) return true;
  return false;
}

const CAPTION_RE = /^(FIGURE|FIG\.|TABLE|BOX|VIDEO|EQUATION|EQ\.)\s+\d+[.\-]?\d*\b/i;

function looksLikeCaptionStart(text: string): boolean {
  return CAPTION_RE.test(text.trim());
}

// ---------- de-hyphenation ----------

function dehyphenateAndJoin(lines: string[]): string {
  if (lines.length === 0) return "";
  let out = lines[0] ?? "";
  for (let i = 1; i < lines.length; i++) {
    const next = lines[i];
    if (!next) continue;
    const m = out.match(/([a-z])-$/);
    if (m && /^[a-z]/.test(next)) {
      out = out.slice(0, -1) + next;
    } else {
      out += (out.endsWith(" ") ? "" : " ") + next;
    }
  }
  return out.replace(/\s+/g, " ").trim();
}

// ---------- bucketing + column logic ----------

function bucketLines(items: PdfItem[]): PdfItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const buckets: PdfItem[][] = [];
  for (const it of sorted) {
    const last = buckets[buckets.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= Y_BUCKET_TOL) {
      last.push(it);
    } else {
      buckets.push([it]);
    }
  }
  return buckets;
}

function isTwoColumnPage(items: PdfItem[], midX: number): boolean {
  let left = 0;
  let right = 0;
  for (const it of items) {
    const cx = it.x + it.width / 2;
    if (cx < midX) left++;
    else right++;
  }
  const total = left + right;
  if (total < 20) return false;
  const minor = Math.min(left, right);
  return minor / total > 0.25;
}

// ---------- sentence-aligned chunking ----------

function findSentenceBreak(text: string, target: number, search: number): number {
  // Look back from `target` for the most recent sentence terminator within
  // `search` chars; if none, fall back to the most recent space.
  const start = Math.max(0, target - search);
  for (let i = target; i >= start; i--) {
    const ch = text[i];
    const next = text[i + 1];
    if ((ch === "." || ch === "?" || ch === "!") && next === " ") return i + 2;
  }
  for (let i = target; i >= start; i--) {
    if (text[i] === " ") return i + 1;
  }
  return target;
}

// ---------- main ----------

export async function extractStructuredChunks(pdfData: Uint8Array): Promise<ExtractedChunk[]> {
  const loadingTask = getDocument({
    data: pdfData,
    verbosity: 0,
    isEvalSupported: false,
    useSystemFonts: false,
  });
  const pdf = await loadingTask.promise;

  // Pass 1: per-page → ordered lines.
  const rawItems: RawItem[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const pageHeight = viewport.height;
    const midX = viewport.width / 2;
    const content = await page.getTextContent();

    const items: PdfItem[] = [];
    for (const it of content.items as unknown as {
      str: string;
      transform: number[];
      width?: number;
    }[]) {
      if (!it.str || !it.str.trim()) continue;
      const size = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10;
      const x = it.transform[4];
      const y = it.transform[5];
      const width =
        typeof it.width === "number" && it.width > 0 ? it.width : it.str.length * size * 0.5;
      items.push({ str: it.str, size, x, y, width });
    }
    if (items.length === 0) {
      page.cleanup();
      continue;
    }

    // Body font for this page
    const sizeWeights = new Map<number, number>();
    for (const it of items) {
      const k = Math.round(it.size * 10) / 10;
      sizeWeights.set(k, (sizeWeights.get(k) ?? 0) + it.str.length);
    }
    let pageBodySize = items[0].size;
    let pageBodyWeight = 0;
    for (const [s, w] of sizeWeights) {
      if (w > pageBodyWeight) {
        pageBodyWeight = w;
        pageBodySize = s;
      }
    }

    // Filter: header/footer band, footnote superscripts, single-char ornaments.
    const bodyItems = items.filter((it) => {
      const inTopBand = it.y >= pageHeight - HEADER_FOOTER_BAND;
      const inBottomBand = it.y <= HEADER_FOOTER_BAND;
      if (inTopBand || inBottomBand) {
        if (looksLikeRunningHeadFoot(it.str)) return false;
        if (it.size < pageBodySize - 1) return false;
      }
      const trimmed = it.str.trim();
      if (it.size < pageBodySize - FOOTNOTE_SIZE_GAP && /^\d+(?:[.,]\d+)?$/.test(trimmed)) {
        return false; // footnote/reference superscript
      }
      if (it.size < pageBodySize - FOOTNOTE_SIZE_GAP && /^[a-z]$/.test(trimmed)) {
        return false; // table footnote markers ᵃ/ᵇ stripped
      }
      return true;
    });
    if (bodyItems.length === 0) {
      page.cleanup();
      continue;
    }

    const twoCol = isTwoColumnPage(bodyItems, midX);
    const buckets = bucketLines(bodyItems);

    const pageLines: PageLine[] = [];
    let leftBuf: PageLine[] = [];
    let rightBuf: PageLine[] = [];

    const flushColumns = () => {
      if (leftBuf.length === 0 && rightBuf.length === 0) return;
      leftBuf.sort((a, b) => b.y - a.y);
      rightBuf.sort((a, b) => b.y - a.y);
      pageLines.push(...leftBuf, ...rightBuf);
      leftBuf = [];
      rightBuf = [];
    };

    for (const bucket of buckets) {
      const xs = [...bucket].sort((a, b) => a.x - b.x);

      if (twoCol) {
        const leftItems: PdfItem[] = [];
        const rightItems: PdfItem[] = [];
        const straddlers: PdfItem[] = [];
        for (const it of xs) {
          const endsBeforeMid = it.x + it.width <= midX + COL_EDGE_TOL;
          const startsAfterMid = it.x >= midX - COL_EDGE_TOL;
          if (endsBeforeMid && !startsAfterMid) leftItems.push(it);
          else if (startsAfterMid && !endsBeforeMid) rightItems.push(it);
          else if (endsBeforeMid && startsAfterMid) {
            const cx = it.x + it.width / 2;
            (cx < midX ? leftItems : rightItems).push(it);
          } else {
            straddlers.push(it);
          }
        }

        if (straddlers.length === 0) {
          if (leftItems.length > 0) {
            const lt = buildLineText(leftItems);
            if (lt) leftBuf.push({ text: lt, size: maxSize(leftItems), y: leftItems[0].y, kind: "left" });
          }
          if (rightItems.length > 0) {
            const rt = buildLineText(rightItems);
            if (rt) rightBuf.push({ text: rt, size: maxSize(rightItems), y: rightItems[0].y, kind: "right" });
          }
          continue;
        }

        flushColumns();
        const t = buildLineText(xs);
        if (t) pageLines.push({ text: t, size: maxSize(xs), y: xs[0].y, kind: "full" });
        continue;
      }

      const t = buildLineText(xs);
      if (t) pageLines.push({ text: t, size: maxSize(xs), y: xs[0].y, kind: "full" });
    }
    flushColumns();

    // Caption suppression: walk lines and skip a contiguous run that starts
    // with FIGURE/TABLE/BOX/etc. and is set in <body font (i.e. visually a
    // caption block). Stop suppressing when we hit a line at body size again.
    let i = 0;
    while (i < pageLines.length) {
      const ln = pageLines[i];
      if (looksLikeCaptionStart(ln.text) && ln.size <= pageBodySize - CAPTION_SIZE_GAP + 0.05) {
        let j = i + 1;
        while (j < pageLines.length && pageLines[j].size <= pageBodySize - CAPTION_SIZE_GAP + 0.05) {
          j++;
        }
        pageLines.splice(i, j - i);
        continue;
      }
      i++;
    }

    for (const ln of pageLines) {
      rawItems.push({
        text: ln.text,
        fontSize: Math.round(ln.size * 10) / 10,
        page: pageNum,
      });
    }
    page.cleanup();
  }

  if (rawItems.length === 0) return [];

  // Body font across the document.
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

  const headingSizes = [...weights.keys()]
    .filter((s) => s > bodySize * HEADING_RATIO)
    .sort((a, b) => b - a)
    .slice(0, MAX_HEADING_LEVELS);
  const sizeToLevel = new Map(headingSizes.map((s, i) => [s, i + 1]));

  // Pass 2: classify, with KEY POINTS forced to a heading.
  const keyPointsLevel = headingSizes.length >= 2 ? 2 : 1;
  const blocks: Block[] = rawItems.map((r) => {
    let level = sizeToLevel.get(r.fontSize);
    let isHeading = level !== undefined;
    if (!isHeading && /^KEY\s+POINTS\b/i.test(r.text) && r.text.length < 30) {
      isHeading = true;
      level = keyPointsLevel;
    }
    return {
      text: r.text,
      fontSize: r.fontSize,
      page: r.page,
      isHeading,
      headingLevel: level,
    };
  });

  // Pass 3: section stack + chunk emission with References cutoff.
  const chunks: ExtractedChunk[] = [];
  const sectionStack: (string | undefined)[] = new Array(MAX_HEADING_LEVELS).fill(undefined);
  let bodyLines: string[] = [];
  let bufLen = 0;
  let bufPageStart = 0;
  let bufPageEnd = 0;
  let bufHeadingLevel: number | null = null;
  let inReferences = false;

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

  const emitChunk = (text: string, headingLevel: number | null, pStart: number, pEnd: number) => {
    if (text.length < MIN_CHUNK_LEN) return;
    const words = text.split(/\s+/).length;
    chunks.push({
      ord: chunks.length,
      text,
      sectionPath: currentSectionPath(),
      headingLevel,
      pageStart: pStart || 1,
      pageEnd: pEnd || pStart || 1,
      tokenCount: Math.ceil(words * 1.3),
    });
  };

  const flushChunk = (carryOverlap: boolean) => {
    const fullText = dehyphenateAndJoin(bodyLines);
    if (fullText.length === 0) {
      bodyLines = [];
      bufLen = 0;
      bufPageStart = 0;
      bufPageEnd = 0;
      bufHeadingLevel = currentHeadingLevel();
      return;
    }

    // Cut at sentence boundary near CHUNK_SIZE; if the buffer is small enough
    // emit the whole thing.
    if (fullText.length <= CHUNK_SIZE * 1.1 || !carryOverlap) {
      emitChunk(fullText, bufHeadingLevel, bufPageStart, bufPageEnd);
      bodyLines = [];
      bufLen = 0;
      bufPageStart = 0;
      bufPageEnd = 0;
      bufHeadingLevel = currentHeadingLevel();
      return;
    }

    const cutAt = findSentenceBreak(fullText, CHUNK_SIZE, 300);
    const head = fullText.slice(0, cutAt).trim();
    emitChunk(head, bufHeadingLevel, bufPageStart, bufPageEnd);

    // Build sentence-aligned overlap as the seed for the next chunk.
    let overlap = fullText.slice(Math.max(cutAt - CHUNK_OVERLAP, 0), cutAt);
    const sentStart = overlap.search(/[.?!]\s+\S/);
    if (sentStart > -1) overlap = overlap.slice(sentStart + 2);
    const tail = (overlap + " " + fullText.slice(cutAt)).replace(/\s+/g, " ").trim();
    bodyLines = [tail];
    bufLen = tail.length;
    // pageStart/End for the carried tail: best-effort use current bufPageEnd.
    bufPageStart = bufPageEnd;
    bufHeadingLevel = currentHeadingLevel();
  };

  for (const b of blocks) {
    if (b.isHeading && b.headingLevel !== undefined) {
      // Boundary: flush any pending body before changing the section stack.
      if (bufLen > 0) flushChunk(false);

      // Stop emitting once we cross into the chapter "References" section.
      if (b.headingLevel <= 2 && /^references\b/i.test(b.text.trim())) {
        inReferences = true;
        sectionStack[b.headingLevel - 1] = b.text;
        for (let i = b.headingLevel; i < MAX_HEADING_LEVELS; i++) sectionStack[i] = undefined;
        continue;
      }
      // A new H1 (chapter restart) re-enables emission.
      if (b.headingLevel === 1) inReferences = false;

      sectionStack[b.headingLevel - 1] = b.text;
      for (let i = b.headingLevel; i < MAX_HEADING_LEVELS; i++) sectionStack[i] = undefined;

      bufHeadingLevel = b.headingLevel;
      if (!inReferences) {
        bodyLines.push(b.text);
        bufLen += b.text.length;
        if (bufPageStart === 0) bufPageStart = b.page;
        bufPageEnd = b.page;
      }
      continue;
    }

    if (inReferences) continue;

    if (bufPageStart === 0) bufPageStart = b.page;
    bufPageEnd = b.page;
    bodyLines.push(b.text);
    bufLen += b.text.length + 1;
    if (bufLen >= CHUNK_SIZE) flushChunk(true);
  }
  if (bufLen > 0) flushChunk(false);

  return chunks;
}
