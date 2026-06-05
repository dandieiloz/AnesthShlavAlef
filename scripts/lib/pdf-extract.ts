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
  /** Printed (textbook) page number if detected from running header/footer. */
  printedPage: number | null;
}

interface Block {
  text: string;
  fontSize: number;
  page: number;
  printedPage: number | null;
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
const CAPTION_KEEP_RE = /^(TABLE|BOX|EQUATION|EQ\.)\s+\d+[.\-]?\d*\b/i;
const CAPTION_FIGURE_RE = /^(FIGURE|FIG\.)\s+\d+[.\-]?\d*\b/i;
const CAPTION_VIDEO_RE = /^(VIDEO)\s+\d+[.\-]?\d*\b/i;
// Figure/Fig. captions are kept only when their body has at least this many
// chars of prose (e.g., Fig. 44.9 decision pathway). Short photo-style
// captions ("Diagram of the larynx.") fall below this threshold and are
// suppressed as before.
const FIGURE_KEEP_MIN_BODY_CHARS = 100;

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

/**
 * Collect every plausible printed-page-number candidate from a single PDF
 * page's running header/footer band. We don't pick a single value here —
 * after all pages are scanned, `pickChapterOffset` deduces the chapter-wide
 * offset (printed = pdf + offset) by majority vote, which is robust to
 * decoy numbers like figure refs ("FIGURE 10-396") or footnote superscripts.
 */
function collectPrintedPageCandidates(items: PdfItem[], pageHeight: number): number[] {
  const out: number[] = [];
  for (const it of items) {
    const inTopBand = it.y >= pageHeight - HEADER_FOOTER_BAND;
    const inBottomBand = it.y <= HEADER_FOOTER_BAND;
    if (!inTopBand && !inBottomBand) continue;
    const trimmed = it.str.trim();
    if (!/^\d{1,4}$/.test(trimmed)) continue;
    const n = Number(trimmed);
    if (n <= 0 || n > 9999) continue;
    out.push(n);
  }
  return out;
}

/**
 * Given per-PDF-page candidate sets, deduce the offset such that
 * `printedPage = pdfPage + offset` agrees with the most pages. Returns null
 * when no offset wins on enough pages — callers should then fall back to
 * the raw PDF page index.
 */
function pickChapterOffset(
  candidatesByPdfPage: Map<number, number[]>,
  totalPages: number,
): number | null {
  const votes = new Map<number, number>();
  for (const [pdfPage, cands] of candidatesByPdfPage) {
    const seen = new Set<number>();
    for (const v of cands) {
      const offset = v - pdfPage;
      if (offset < 0) continue; // textbook page never precedes pdf page within a chapter PDF
      if (seen.has(offset)) continue;
      seen.add(offset);
      votes.set(offset, (votes.get(offset) ?? 0) + 1);
    }
  }
  let bestOffset: number | null = null;
  let bestVotes = 0;
  for (const [o, v] of votes) {
    if (v > bestVotes) {
      bestVotes = v;
      bestOffset = o;
    }
  }
  // Need consistent agreement across the chapter: at least 3 pages and at
  // least ~30% of pages with detected candidates voting the same offset.
  const minVotes = Math.max(3, Math.ceil(totalPages * 0.3));
  if (bestVotes < minVotes) return null;
  return bestOffset;
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
  // Track the (pdfPage, candidate-set) pairs to deduce a single chapter-wide
  // printed-page offset after all pages are processed.
  const printedPageCandidates = new Map<number, number[]>();
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

    const pageCands = collectPrintedPageCandidates(items, pageHeight);
    if (pageCands.length > 0) printedPageCandidates.set(pageNum, pageCands);

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

    // Selective caption handling: previously we dropped any contiguous below-
    // body-font run that started with FIGURE/TABLE/BOX/etc., which stripped
    // every table/box body from the index. Now we KEEP tables, boxes, and
    // equations (their bodies carry answer-relevant cells), KEEP text-rich
    // figure captions, and only drop short photo-style figure captions and
    // VIDEO placeholders. Preserved lines are bumped to body font so the
    // downstream heading classifier and chunker treat them as normal prose.
    let i = 0;
    while (i < pageLines.length) {
      const ln = pageLines[i];
      const isCaption =
        looksLikeCaptionStart(ln.text) &&
        ln.size <= pageBodySize - CAPTION_SIZE_GAP + 0.05;
      if (!isCaption) {
        i++;
        continue;
      }
      let j = i + 1;
      while (j < pageLines.length && pageLines[j].size <= pageBodySize - CAPTION_SIZE_GAP + 0.05) {
        j++;
      }
      const captionText = ln.text;
      const bodyChars = pageLines.slice(i + 1, j).reduce((n, l) => n + l.text.length, 0);
      const keepKind =
        CAPTION_KEEP_RE.test(captionText)
          ? "table-or-box"
          : CAPTION_FIGURE_RE.test(captionText) && bodyChars >= FIGURE_KEEP_MIN_BODY_CHARS
            ? "figure"
            : CAPTION_VIDEO_RE.test(captionText)
              ? "drop"
              : "drop";
      if (keepKind === "drop") {
        pageLines.splice(i, j - i);
        continue;
      }
      for (let k = i; k < j; k++) {
        pageLines[k] = { ...pageLines[k], size: pageBodySize };
      }
      i = j;
    }

    for (const ln of pageLines) {
      rawItems.push({
        text: ln.text,
        fontSize: Math.round(ln.size * 10) / 10,
        page: pageNum,
        printedPage: null, // assigned after the loop using chapter-wide offset
      });
    }
    page.cleanup();
  }

  if (rawItems.length === 0) return [];

  // Deduce the chapter-wide printed-page offset and apply it.
  const chapterOffset = pickChapterOffset(printedPageCandidates, pdf.numPages);
  if (chapterOffset !== null) {
    for (const r of rawItems) {
      r.printedPage = r.page + chapterOffset;
    }
  }

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
    // Guard against body sentences that happen to match a heading font size
    // (drop caps, pull quotes, oversized inline math, etc.). Real headings
    // are short, start with a capital/digit, and don't contain mid-sentence
    // punctuation followed by more words.
    if (isHeading) {
      const t = r.text.trim();
      const tooLong = t.length > 80;
      const startsLower = /^[a-z]/.test(t);
      const midSentence = /[.?!]\s+\S/.test(t);
      const endsMidSentence = /[,;:]$/.test(t);
      if (tooLong || startsLower || midSentence || endsMidSentence) {
        isHeading = false;
        level = undefined;
      }
    }
    if (!isHeading && /^KEY\s+POINTS\b/i.test(r.text) && r.text.length < 30) {
      isHeading = true;
      level = keyPointsLevel;
    }
    return {
      text: r.text,
      fontSize: r.fontSize,
      page: r.page,
      printedPage: r.printedPage,
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
  // Tracks the level of the most recently set heading so a wrapped title
  // (two consecutive heading lines at the same font size) is merged into
  // the previous stack slot instead of overwriting it.
  let lastHeadingLevel: number | null = null;

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
        lastHeadingLevel = b.headingLevel;
        continue;
      }
      // A new H1 (chapter restart) re-enables emission.
      if (b.headingLevel === 1) inReferences = false;

      // Wrapped heading: same level back-to-back with no body in between
      // means the title spilled to a second line. Merge instead of replacing.
      if (
        lastHeadingLevel === b.headingLevel &&
        sectionStack[b.headingLevel - 1] &&
        bodyLines.length <= 1
      ) {
        const prev = sectionStack[b.headingLevel - 1] as string;
        const merged =
          /[a-z]-$/.test(prev) ? prev.slice(0, -1) + b.text : `${prev} ${b.text}`.replace(/\s+/g, " ");
        sectionStack[b.headingLevel - 1] = merged;
        // Replace the just-pushed prev heading line in bodyLines with the merged form.
        if (bodyLines.length === 1 && bodyLines[0] === prev) {
          bodyLines[0] = merged;
          bufLen = merged.length;
        }
      } else {
        sectionStack[b.headingLevel - 1] = b.text;
        for (let i = b.headingLevel; i < MAX_HEADING_LEVELS; i++) sectionStack[i] = undefined;
      }
      lastHeadingLevel = b.headingLevel;

      bufHeadingLevel = b.headingLevel;
      if (!inReferences) {
        // For a merged wrap, the prev line was already adjusted above; just
        // update page bounds. Otherwise push the new heading line.
        const isMergeContinuation =
          lastHeadingLevel === b.headingLevel &&
          bodyLines.length === 1 &&
          sectionStack[b.headingLevel - 1] === bodyLines[0];
        if (!isMergeContinuation) {
          bodyLines.push(b.text);
          bufLen += b.text.length;
        }
        const p = b.printedPage ?? b.page;
        if (bufPageStart === 0) bufPageStart = p;
        bufPageEnd = p;
      }
      continue;
    }

    if (inReferences) continue;

    // Any non-heading block ends the consecutive-heading run.
    lastHeadingLevel = null;
    {
      const p = b.printedPage ?? b.page;
      if (bufPageStart === 0) bufPageStart = p;
      bufPageEnd = p;
    }
    bodyLines.push(b.text);
    bufLen += b.text.length + 1;
    if (bufLen >= CHUNK_SIZE) flushChunk(true);
  }
  if (bufLen > 0) flushChunk(false);

  return chunks;
}
