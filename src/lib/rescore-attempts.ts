import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

type Choice = "A" | "B" | "C" | "D";

/**
 * Recompute and persist `Attempt.isCorrect` for every attempt of a question so
 * stored correctness matches the question's CURRENT effective answer set.
 *
 * The effective set is the primary answer
 * (`geminiAnswer.correctAnswer ?? question.correctAnswer`) unioned with
 * `question.acceptedAnswers`. This keeps historical stats (success rate,
 * "תשובות נכונות") consistent with the live answer shown in the answer
 * distribution after an admin changes or regenerates the correct answer.
 *
 * Idempotent: safe to call after any answer-mutation. Pass a transaction
 * client to run inside an existing `$transaction`.
 */
export async function rescoreAttemptsForQuestion(
  questionId: number,
  client: Prisma.TransactionClient = db,
): Promise<void> {
  const q = await client.question.findUnique({
    where: { id: questionId },
    select: {
      correctAnswer: true,
      acceptedAnswers: true,
      geminiAnswer: { select: { correctAnswer: true } },
    },
  });
  if (!q) return;

  const primary = q.geminiAnswer?.correctAnswer ?? q.correctAnswer ?? null;
  // No known answer yet — leave attempts untouched (they were scored against
  // whatever was effective when they were recorded).
  if (!primary) return;

  const acceptedList = Array.from(
    new Set<Choice>([primary as Choice, ...(q.acceptedAnswers as Choice[])]),
  );

  await client.attempt.updateMany({
    where: { questionId, chosen: { in: acceptedList } },
    data: { isCorrect: true },
  });
  await client.attempt.updateMany({
    where: { questionId, chosen: { notIn: acceptedList } },
    data: { isCorrect: false },
  });
}
