import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// LaTeX → JSON-escape corruption leaves stray control chars in the text:
//   \text  → TAB+"ext"   (\t)
//   \beta  → BS+"eta"    (\b)
//   \frac  → FF+"rac"    (\f)
//   \nabla → LF+"abla"   (\n)   — could appear in legit prose but very rare mid-line
//   \rho   → CR+"ho"     (\r)
const CONTROL_CHARS = /[\t\b\f]/;

async function main() {
  const answers = await prisma.geminiAnswer.findMany({
    select: {
      id: true,
      questionId: true,
      explanation: true,
      rawMarkdown: true,
      whyOthersWrong: true,
      generatedAt: true,
    },
    orderBy: { questionId: "asc" },
  });

  const bad: Array<{ questionId: number; samples: string[] }> = [];
  for (const a of answers) {
    const haystack = `${a.explanation}\n${a.rawMarkdown}\n${a.whyOthersWrong}`;
    if (!CONTROL_CHARS.test(haystack)) continue;
    // Pull a short snippet around the first hit for human verification.
    const m = CONTROL_CHARS.exec(haystack);
    const idx = m?.index ?? 0;
    const snippet = haystack.slice(Math.max(0, idx - 30), idx + 30).replace(/[\t\b\f\r\n]/g, (c) => {
      return { "\t": "[\\t]", "\b": "[\\b]", "\f": "[\\f]", "\r": "[\\r]", "\n": "[\\n]" }[c] ?? c;
    });
    bad.push({ questionId: a.questionId, samples: [snippet] });
  }

  console.log(`Scanned ${answers.length} GeminiAnswer rows.`);
  console.log(`Found ${bad.length} with LaTeX-corruption control chars:\n`);
  for (const b of bad) {
    console.log(`  Q${b.questionId}  …${b.samples[0]}…`);
  }

  // Also report cache entries that would re-poison a regeneration if not invalidated.
  const cacheRows = await prisma.questionQueryCache.findMany({
    select: { questionHash: true, payload: true },
  });
  let badCache = 0;
  for (const c of cacheRows) {
    const payload = c.payload as { structured?: { explanation?: string }; rawMarkdown?: string } | null;
    const text = `${payload?.structured?.explanation ?? ""}\n${payload?.rawMarkdown ?? ""}`;
    if (CONTROL_CHARS.test(text)) badCache++;
  }
  console.log(`\nCorrupted QuestionQueryCache entries: ${badCache} / ${cacheRows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
