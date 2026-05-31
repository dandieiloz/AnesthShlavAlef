/**
 * Enqueue REGENERATE jobs for every question whose stored explanation contains
 * the LaTeX-corruption signature (TAB/BS/FF chars from JSON-escape collapse).
 *
 * Skips questions that already have an open PENDING/PROCESSING job.
 * Run the actual generation from /admin/queue.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CONTROL_CHARS = /[\t\b\f]/;

async function main() {
  const answers = await prisma.geminiAnswer.findMany({
    select: { questionId: true, explanation: true, rawMarkdown: true, whyOthersWrong: true },
  });

  const affected = answers
    .filter((a) => CONTROL_CHARS.test(`${a.explanation}\n${a.rawMarkdown}\n${a.whyOthersWrong}`))
    .map((a) => a.questionId);

  if (affected.length === 0) {
    console.log("No corrupted explanations found.");
    return;
  }

  // Skip questions that already have an open job
  const openJobs = await prisma.answerGenerationJob.findMany({
    where: { questionId: { in: affected }, status: { in: ["PENDING", "PROCESSING"] } },
    select: { questionId: true },
  });
  const openSet = new Set(openJobs.map((j) => j.questionId));
  const toEnqueue = affected.filter((id) => !openSet.has(id));

  console.log(`Affected: ${affected.length}  Already queued: ${openSet.size}  Enqueueing: ${toEnqueue.length}`);

  for (const questionId of toEnqueue) {
    await prisma.answerGenerationJob.create({
      data: { questionId, kind: "REGENERATE" },
    });
    console.log(`  + Q${questionId}`);
  }

  console.log("\nDone. Go to /admin/queue and press the run/start button to process them.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
