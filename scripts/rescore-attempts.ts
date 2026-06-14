/**
 * Backfill Attempt.isCorrect so stored correctness matches each question's
 * CURRENT effective answer set.
 *
 * Why: isCorrect is computed once, when an attempt is recorded, and was never
 * updated when a question's correct answer later changed (admin edit, accepted
 * answers, or an AI regeneration accepted as the live answer). This drifted the
 * per-question success-rate / "תשובות נכונות" stats out of sync with the answer
 * distribution, which always reflects the live correct answer.
 *
 * Effective answer set per question:
 *   primary = geminiAnswer.correctAnswer ?? question.correctAnswer
 *   accepted = primary ∪ question.acceptedAnswers
 * An attempt is correct iff its `chosen` is in that set. Questions with no known
 * answer (primary === null) are skipped — their attempts keep their original
 * scoring.
 *
 * Run with:  npx tsx scripts/rescore-attempts.ts [--dry]
 *   --dry  Report how many attempts would flip, without writing.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry");

type Choice = "A" | "B" | "C" | "D";

async function main() {
  const questions = await prisma.question.findMany({
    select: {
      id: true,
      correctAnswer: true,
      acceptedAnswers: true,
      geminiAnswer: { select: { correctAnswer: true } },
    },
  });

  let scanned = 0;
  let skipped = 0;
  let flippedToCorrect = 0;
  let flippedToWrong = 0;

  for (const q of questions) {
    const primary = q.geminiAnswer?.correctAnswer ?? q.correctAnswer ?? null;
    if (!primary) {
      skipped++;
      continue;
    }
    scanned++;
    const acceptedList = Array.from(
      new Set<Choice>([primary as Choice, ...(q.acceptedAnswers as Choice[])]),
    );

    if (DRY_RUN) {
      const [toCorrect, toWrong] = await Promise.all([
        prisma.attempt.count({
          where: { questionId: q.id, chosen: { in: acceptedList }, isCorrect: false },
        }),
        prisma.attempt.count({
          where: { questionId: q.id, chosen: { notIn: acceptedList }, isCorrect: true },
        }),
      ]);
      flippedToCorrect += toCorrect;
      flippedToWrong += toWrong;
      continue;
    }

    const [toCorrect, toWrong] = await Promise.all([
      prisma.attempt.updateMany({
        where: { questionId: q.id, chosen: { in: acceptedList }, isCorrect: false },
        data: { isCorrect: true },
      }),
      prisma.attempt.updateMany({
        where: { questionId: q.id, chosen: { notIn: acceptedList }, isCorrect: true },
        data: { isCorrect: false },
      }),
    ]);
    flippedToCorrect += toCorrect.count;
    flippedToWrong += toWrong.count;
  }

  console.log(`Scanned ${scanned} answered questions (${skipped} skipped — no known answer).`);
  console.log(`  → attempts flipped false → true: ${flippedToCorrect}`);
  console.log(`  → attempts flipped true → false: ${flippedToWrong}`);
  if (DRY_RUN) {
    console.log("\n[dry run] No changes written. Re-run without --dry to apply.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
