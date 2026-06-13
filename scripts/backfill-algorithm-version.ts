/**
 * Backfill GeminiAnswer.algorithmVersion for existing answers.
 *
 * Classification (per product decision):
 *   - version 2: the answer was produced by a "pro" generation model AND its
 *     explanation contains at least one inline citation marker such as [1] / [2]
 *     (these markers are a hallmark of the v2 RAG pipeline).
 *   - version 1: everything else (legacy answers, non-pro/older models, or pro
 *     answers with no inline citations in the explanation).
 *
 * The migration added the column with a default of 2, so this script's job is to
 * (re)assert the correct value for every existing row — primarily flipping the
 * legacy rows down to 1.
 *
 * Run with:  npx tsx scripts/backfill-algorithm-version.ts [--dry]
 *   --dry  Preview the classification counts without writing to the database.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry");
const CHUNK_SIZE = 500;

/**
 * True when `text` contains an inline citation marker like [1], [2] or [1, 2],
 * ignoring any markers that appear inside `$...$` / `$$...$$` math spans. This
 * mirrors injectCitationAnchors() in src/components/AnswerExplanation.tsx so the
 * detection matches exactly what renders as a clickable citation.
 */
function hasInlineCitation(text: string): boolean {
  if (!text) return false;
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return parts.some(
    (part, idx) => idx % 2 === 0 && /(?<!\[)\[\s*\d+(?:\s*,\s*\d+)*\s*\](?!\()/.test(part),
  );
}

function isProModel(model: string): boolean {
  return /pro/i.test(model);
}

function classify(model: string, explanation: string): 1 | 2 {
  return isProModel(model) && hasInlineCitation(explanation) ? 2 : 1;
}

async function updateInChunks(ids: number[], version: 1 | 2): Promise<number> {
  let updated = 0;
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const res = await prisma.geminiAnswer.updateMany({
      where: { id: { in: chunk } },
      data: { algorithmVersion: version },
    });
    updated += res.count;
  }
  return updated;
}

async function main() {
  const answers = await prisma.geminiAnswer.findMany({
    select: { id: true, model: true, explanation: true, algorithmVersion: true },
  });

  const v1Ids: number[] = [];
  const v2Ids: number[] = [];
  for (const a of answers) {
    if (classify(a.model, a.explanation) === 1) v1Ids.push(a.id);
    else v2Ids.push(a.id);
  }

  console.log(`Scanned ${answers.length} GeminiAnswer rows.`);
  console.log(`  → version 1 (legacy / non-pro / no citations): ${v1Ids.length}`);
  console.log(`  → version 2 (pro model + inline citations):     ${v2Ids.length}`);

  if (DRY_RUN) {
    console.log("\n[dry run] No changes written. Re-run without --dry to apply.");
    return;
  }

  const updated1 = await updateInChunks(v1Ids, 1);
  const updated2 = await updateInChunks(v2Ids, 2);
  console.log(`\nApplied: ${updated1} rows set to v1, ${updated2} rows set to v2.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
