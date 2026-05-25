/**
 * Re-ingest every chapter PDF in textbook/ using the v2 heading-aware pipeline.
 *
 *   npm run ingest:all                  — skip chapters already ingested
 *   npm run ingest:all -- --force       — re-ingest everything
 *   npm run ingest:all -- --only 11,24  — only these chapter numbers
 *   npm run ingest:all -- --from 50     — only chapters >= 50
 *
 * Resumable: stops cleanly on Ctrl-C; rerun to continue (skips done chapters).
 */
import { db } from "../src/lib/db";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import { ingestChapter } from "./ingest-chapter";

const TEXTBOOK_DIR = path.resolve(process.cwd(), "textbook");
// Filenames look like:  "Ch 11 - Neuromuscular Physiology and Pharmacology.pdf"
const FILENAME_RE = /^Ch\s+(\d+)\s*-/i;

interface CliArgs {
  force: boolean;
  only: Set<number> | null;
  from: number | null;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let force = false;
  let only: Set<number> | null = null;
  let from: number | null = null;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--force") force = true;
    else if (a === "--only") {
      const list = args[++i] ?? "";
      only = new Set(list.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n)));
    } else if (a === "--from") {
      from = Number(args[++i]);
    }
  }
  return { force, only, from };
}

async function discoverPdfs(): Promise<{ chapterNumber: number; pdfPath: string }[]> {
  const entries = await readdir(TEXTBOOK_DIR);
  const found: { chapterNumber: number; pdfPath: string }[] = [];
  for (const name of entries) {
    if (!name.toLowerCase().endsWith(".pdf")) continue;
    const m = FILENAME_RE.exec(name);
    if (!m) {
      console.warn(`skip (no chapter number): ${name}`);
      continue;
    }
    found.push({ chapterNumber: Number(m[1]), pdfPath: path.join(TEXTBOOK_DIR, name) });
  }
  found.sort((a, b) => a.chapterNumber - b.chapterNumber);
  return found;
}

async function main() {
  const args = parseArgs();
  const allPdfs = await discoverPdfs();
  const filtered = allPdfs.filter((p) => {
    if (args.only && !args.only.has(p.chapterNumber)) return false;
    if (args.from !== null && p.chapterNumber < args.from) return false;
    return true;
  });

  console.log(`discovered ${allPdfs.length} PDFs; processing ${filtered.length} after filters`);
  console.log(`force=${args.force} only=${args.only ? [...args.only].join(",") : "-"} from=${args.from ?? "-"}`);

  // Pre-fetch ingest status to decide skips
  const chapters = await db.chapter.findMany({
    select: { number: true, ingestedAt: true, id: true },
  });
  const statusByNum = new Map(chapters.map((c) => [c.number, c]));

  const t0 = Date.now();
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of filtered) {
    const status = statusByNum.get(p.chapterNumber);
    if (!status) {
      console.warn(`[ch${p.chapterNumber}] no Chapter row in DB — run db:seed first. Skipping.`);
      skipped++;
      continue;
    }
    if (!args.force && status.ingestedAt) {
      console.log(`[ch${p.chapterNumber}] already ingested at ${status.ingestedAt.toISOString()} — skip (use --force to redo)`);
      skipped++;
      continue;
    }
    const fileInfo = await stat(p.pdfPath);
    console.log(`\n=== [ch${p.chapterNumber}] ${path.basename(p.pdfPath)} (${(fileInfo.size / 1024).toFixed(0)} KB) ===`);
    const t1 = Date.now();
    try {
      await ingestChapter(p.chapterNumber, p.pdfPath);
      done++;
      console.log(`[ch${p.chapterNumber}] elapsed ${((Date.now() - t1) / 1000).toFixed(1)}s`);
    } catch (e) {
      failed++;
      console.error(`[ch${p.chapterNumber}] FAILED:`, e);
    }
  }

  console.log(`\n=== summary ===`);
  console.log(`done: ${done}, skipped: ${skipped}, failed: ${failed}, total elapsed: ${((Date.now() - t0) / 60_000).toFixed(1)} min`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
