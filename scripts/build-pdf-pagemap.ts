/**
 * Build a printed-page → PDF-page map for the textbook PDF.
 *
 *   npx tsx scripts/build-pdf-pagemap.ts <pathToFullTextbookPdf>
 *
 * Output: public/textbook-pagemap.json with run-length-encoded breakpoints:
 *   { fromPrinted, offset } means "for printed page P >= fromPrinted (until
 *   the next breakpoint), pdfPage = P + offset".
 *
 * Heuristic: scan top/bottom bands of every PDF page for short numeric tokens
 * that look like running page numbers, then walk pages left→right keeping an
 * "expected next printed page" counter that tolerates small skips (blank
 * pages / part-title pages) and resets sensibly when content restarts (e.g.
 * Roman-numeral front matter ending and Arabic numerals beginning at 1).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const HEADER_FOOTER_BAND = 50;
const MAX_FORWARD_GAP = 3; // tolerate up to 2 blank pages between printed numbers

type PdfItem = { str: string; size: number; x: number; y: number };

async function pageCandidates(
  page: Awaited<ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>>,
): Promise<number[]> {
  const viewport = page.getViewport({ scale: 1 });
  const pageHeight = viewport.height;
  const content = await page.getTextContent();
  const items: PdfItem[] = [];
  for (const it of content.items as unknown as {
    str: string;
    transform: number[];
  }[]) {
    if (!it.str || !it.str.trim()) continue;
    const size = Math.abs(it.transform[0]) || Math.abs(it.transform[3]) || 10;
    items.push({ str: it.str, size, x: it.transform[4], y: it.transform[5] });
  }
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

function pickPrinted(
  cands: number[],
  expected: number | null,
): number | null {
  if (cands.length === 0) return null;
  // Prefer a candidate close to `expected` (forward, small gap), else the
  // smallest reasonable candidate.
  if (expected != null) {
    let best: number | null = null;
    let bestDelta = Infinity;
    for (const c of cands) {
      const delta = c - expected;
      if (delta >= 0 && delta < MAX_FORWARD_GAP && delta < bestDelta) {
        best = c;
        bestDelta = delta;
      }
    }
    if (best != null) return best;
  }
  // No reasonable forward match — pick the smallest candidate as a fresh anchor.
  return Math.min(...cands);
}

type Detection = { pdfPage: number; printed: number };

async function detectPrintedPages(pdfPath: string): Promise<{
  detections: Detection[];
  totalPages: number;
}> {
  const data = new Uint8Array(await readFile(pdfPath));
  const pdf = await getDocument({
    data,
    verbosity: 0,
    isEvalSupported: false,
    useSystemFonts: false,
  }).promise;

  const detections: Detection[] = [];
  let expected: number | null = null;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const cands = await pageCandidates(page);
    page.cleanup();
    const printed = pickPrinted(cands, expected);
    if (printed != null) {
      detections.push({ pdfPage: p, printed });
      expected = printed + 1;
    } else if (expected != null) {
      // Assume blank/figure page; advance the expected counter.
      expected = expected + 1;
    }
    if (p % 50 === 0) {
      process.stdout.write(`  scanned ${p}/${pdf.numPages}\r`);
    }
  }
  process.stdout.write("\n");
  return { detections, totalPages: pdf.numPages };
}

type Breakpoint = { fromPrinted: number; offset: number };

function compressToBreakpoints(detections: Detection[]): Breakpoint[] {
  // Reject impossible detections: a real textbook always has front matter,
  // so PDF page must be >= printed page (offset >= 0).
  const plausible = detections.filter((d) => d.pdfPage - d.printed >= 0);

  // Filter outliers: drop a detection if its offset disagrees with both
  // immediate neighbors (likely a stray figure/footnote number).
  const cleaned = plausible.filter((d, i) => {
    const offset = d.pdfPage - d.printed;
    const prev = plausible[i - 1];
    const next = plausible[i + 1];
    const prevOk = prev && prev.pdfPage - prev.printed === offset;
    const nextOk = next && next.pdfPage - next.printed === offset;
    if (!prev || !next) return true;
    return prevOk || nextOk;
  });

  // Build raw runs in PDF order, tracking how many detections support each.
  const raw: Array<Breakpoint & { count: number }> = [];
  for (const d of cleaned) {
    const offset = d.pdfPage - d.printed;
    const last = raw[raw.length - 1];
    if (!last || last.offset !== offset) {
      raw.push({ fromPrinted: d.printed, offset, count: 1 });
    } else {
      last.count++;
    }
  }

  // Drop short runs (fewer than MIN_RUN_LEN supporting detections). These are
  // almost always front-matter noise — e.g. a stray "9" matched on the
  // copyright/TOC pages creating a 1–2 page run with offset ≈ 0.
  const MIN_RUN_LEN = 3;
  const longEnough = raw.filter((r) => r.count >= MIN_RUN_LEN);

  // Enforce monotonic-increasing fromPrinted by dropping any run that
  // doesn't extend the printed-page progression. This filters out
  // front-matter noise (TOC numbers, Roman-numeral pages misread as Arabic)
  // that creates "earlier printed page on a later PDF page" entries.
  const monotone: Breakpoint[] = [];
  for (const bp of longEnough) {
    const last = monotone[monotone.length - 1];
    if (!last) {
      monotone.push({ fromPrinted: bp.fromPrinted, offset: bp.offset });
      continue;
    }
    if (bp.fromPrinted > last.fromPrinted) {
      monotone.push({ fromPrinted: bp.fromPrinted, offset: bp.offset });
    }
    // else: bp.fromPrinted <= last.fromPrinted means we went "backward" in
    // printed numbering — almost certainly a stray match. Skip it.
  }
  return monotone;
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath) {
    console.error("Usage: npx tsx scripts/build-pdf-pagemap.ts <pathToPdf>");
    process.exit(1);
  }
  const abs = path.resolve(pdfPath);
  console.log(`Scanning ${abs}…`);
  const { detections, totalPages } = await detectPrintedPages(abs);
  console.log(`Detected printed numbers on ${detections.length}/${totalPages} pages.`);
  const breakpoints = compressToBreakpoints(detections);
  console.log(`Compressed to ${breakpoints.length} offset breakpoint(s).`);

  const outDir = path.resolve("public");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "textbook-pagemap.json");
  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    sourcePdf: path.basename(abs),
    pdfPageCount: totalPages,
    detectionCount: detections.length,
    breakpoints,
  };
  await writeFile(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${outPath}`);
  if (breakpoints.length <= 20) {
    console.log("\nBreakpoints:");
    for (const b of breakpoints) {
      console.log(`  printed ≥ ${b.fromPrinted} → offset ${b.offset}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
