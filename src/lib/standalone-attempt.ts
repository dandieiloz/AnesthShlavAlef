import { z } from "zod";
import type { Choice } from "@prisma/client";
import { db } from "@/lib/db";
import { assertCanAccessQuestion, type PlanGatedUser } from "@/lib/plan";

const Schema = z.object({
  questionId: z.number().int().positive(),
  chosen: z.enum(["A", "B", "C", "D"]),
});

/** Grade and store an attempt that doesn't belong to any quiz. */
export async function recordStandaloneAttempt(
  user: PlanGatedUser,
  input: { questionId: number; chosen: "A" | "B" | "C" | "D" },
): Promise<{ isCorrect: boolean }> {
  const data = Schema.parse(input);
  await assertCanAccessQuestion(user, data.questionId);
  const q = await db.question.findUnique({
    where: { id: data.questionId },
    select: { correctAnswer: true, acceptedAnswers: true, geminiAnswer: { select: { correctAnswer: true } } },
  });
  const correctAnswer = q?.geminiAnswer?.correctAnswer ?? q?.correctAnswer ?? null;
  if (!correctAnswer) throw new Error("No answer for question");
  const isCorrect = data.chosen === correctAnswer || (q?.acceptedAnswers ?? []).includes(data.chosen as Choice);

  // Ignore accidental double submissions within a few seconds.
  const recent = await db.attempt.findFirst({
    where: {
      userId: user.id,
      quizId: null,
      questionId: data.questionId,
      chosen: data.chosen as Choice,
      createdAt: { gte: new Date(Date.now() - 10_000) },
    },
    select: { id: true },
  });
  if (!recent) {
    await db.attempt.create({
      data: { userId: user.id, questionId: data.questionId, chosen: data.chosen as Choice, isCorrect },
    });
  }
  return { isCorrect };
}
