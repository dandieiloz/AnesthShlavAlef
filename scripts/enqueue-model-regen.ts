/**
 * Enqueue REGENERATE jobs for every live answer produced by a given model
 * below a given algorithm version (default: the shallow v3 answers made by
 * gemini-3.1-pro-preview before the v4 Gemini 3 tuning).
 *
 *   npx tsx scripts/enqueue-model-regen.ts [model] [belowVersion] [--dry-run]
 *
 * Skips questions that already have an open PENDING/PROCESSING job.
 * Run the actual generation from /admin/queue. Each completed REGENERATE job
 * stages a candidate at /admin/candidates for admin review/accept; live
 * answers remain unchanged until accepted.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--dry-run");
  const dryRun = process.argv.includes("--dry-run");
  const model = args[0] ?? "gemini-3.1-pro-preview";
  const belowVersion = Number(args[1] ?? 4);

  const answers = await prisma.geminiAnswer.findMany({
    where: { model, algorithmVersion: { lt: belowVersion } },
    select: { questionId: true },
    orderBy: { generatedAt: "asc" },
  });
  const affected = answers.map((a) => a.questionId);

  if (affected.length === 0) {
    console.log(`No ${model} answers below v${belowVersion}.`);
    return;
  }

  const openJobs = await prisma.answerGenerationJob.findMany({
    where: { questionId: { in: affected }, status: { in: ["PENDING", "PROCESSING"] } },
    select: { questionId: true },
  });
  const openSet = new Set(openJobs.map((j) => j.questionId));
  const toEnqueue = affected.filter((id) => !openSet.has(id));

  console.log(
    `${model} < v${belowVersion}: ${affected.length}  Already queued: ${openSet.size}  ` +
      `${dryRun ? "Would enqueue" : "Enqueueing"}: ${toEnqueue.length}`,
  );
  if (dryRun) {
    console.log(`  ${toEnqueue.map((id) => `Q${id}`).join(" ")}`);
    return;
  }

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
