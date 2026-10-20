/**
 * Dry-run the RAG answer pipeline for questions WITHOUT persisting anything,
 * and print the new answer next to the stored one for comparison.
 *
 *   npx tsx scripts/preview-answer.ts <questionId> [<questionId> ...]
 *   npx tsx scripts/preview-answer.ts --latest-model gemini-3.1-pro-preview 3
 */
import "dotenv/config";
import { db } from "@/lib/db";
import { GEN_MODEL } from "@/lib/gemini";
import { retrieveCandidates } from "@/lib/rag/retrieve";
import { rerankWithFlashJudge, pickDiverseTopN } from "@/lib/rag/rerank";
import { runGenerationPass } from "@/lib/rag/answer";

async function resolveIds(argv: string[]): Promise<number[]> {
  if (argv[0] === "--latest-model") {
    const rows = await db.geminiAnswer.findMany({
      where: { model: argv[1] },
      orderBy: { generatedAt: "desc" },
      take: Number(argv[2] ?? 3),
      select: { questionId: true },
    });
    return rows.map((r) => r.questionId);
  }
  return argv.map(Number).filter(Number.isFinite);
}

function stats(explanation: string, wow: string, evidence: number) {
  return `explanation=${explanation.length}ch whyOthersWrong=${wow.length}ch evidence=${evidence}`;
}

async function main() {
  const ids = await resolveIds(process.argv.slice(2));
  for (const id of ids) {
    const q = await db.question.findUniqueOrThrow({ where: { id }, include: { geminiAnswer: true } });
    const hebrewQuery = [q.stem, "א.", q.optionA, "ב.", q.optionB, "ג.", q.optionC, "ד.", q.optionD].join(" ");
    const rerankQuery = [q.stem, `א. ${q.optionA}`, `ב. ${q.optionB}`, `ג. ${q.optionC}`, `ד. ${q.optionD}`].join("\n");
    const candidates = await retrieveCandidates({ hebrewQuery, englishQuery: q.stemEn, perQueryK: 30 });
    const pool = await rerankWithFlashJudge(rerankQuery, candidates, 25);
    const chunks = pickDiverseTopN(pool, 15, 5);
    const t0 = Date.now();
    const s = await runGenerationPass(GEN_MODEL, chunks, q);
    const wow = Object.entries(s.whyOthersWrong).filter(([k]) => k !== s.correctAnswer).map(([, v]) => v).join("\n");

    const old = q.geminiAnswer;
    console.log(`\n================ Q${id} (${GEN_MODEL}, ${Date.now() - t0}ms) ================`);
    if (old) {
      const oldEv = Array.isArray(old.evidenceCitations) ? old.evidenceCitations.length : 0;
      console.log(`OLD [${old.model} v${old.algorithmVersion}] answer=${old.correctAnswer} ${stats(old.explanation, old.whyOthersWrong, oldEv)}`);
    }
    console.log(`NEW answer=${s.correctAnswer} conf=${s.confidence} insufficient=${s.insufficientEvidence} ${stats(s.explanation, wow, s.evidence.length)}`);
    console.log(`\n-- translation --\n${s.translation}\n\n-- explanation --\n${s.explanation}\n\n-- whyOthersWrong --\n${wow}`);
    console.log(`\n-- evidence --\n${s.evidence.map((e, i) => `[${i + 1}] ch${e.chapterNumber} p${e.pageStart ?? "?"}: ${e.quote}`).join("\n")}`);
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
