"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getContentLocale, getLocale } from "@/lib/locale";
import { hasUsableAnswerWhere, questionAccessWhere } from "@/lib/plan";
import { getSavedQuestionIds, getWrongQuestionIds } from "@/lib/my-questions";
import { reviewQuizBaseName, withDate } from "@/lib/quiz-names";
import { recordStandaloneAttempt } from "@/lib/standalone-attempt";

const ReviewQuizSchema = z.object({
  source: z.enum(["wrong", "saved"]),
  name: z.string().max(200).optional(),
  questionLimit: z.coerce.number().int().min(1).optional(),
});

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Build a quiz from the user's own question lists: questions whose latest
 * answer was wrong, or saved (bookmarked / highlighted) questions. The quiz is
 * a fixed, shuffled set, so already-answered questions are served again.
 */
export async function createReviewQuizAction(formData: FormData) {
  const me = await requireUser();
  const raw = formData.get("questionLimit");
  const data = ReviewQuizSchema.parse({
    source: formData.get("reviewSource"),
    name: (formData.get("name") as string | null) || undefined,
    questionLimit: raw && String(raw).trim() !== "" ? raw : undefined,
  });
  const [locale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);

  const candidateIds =
    data.source === "wrong" ? await getWrongQuestionIds(me) : await getSavedQuestionIds(me, contentLocale);

  // Keep only questions that can actually be served (usable answer, plan gate).
  const planGate = await questionAccessWhere(me);
  const usable = candidateIds.length
    ? await db.question.findMany({
        where: { id: { in: candidateIds }, AND: [planGate, hasUsableAnswerWhere] },
        select: { id: true, chapterIds: true },
      })
    : [];

  if (usable.length === 0) {
    redirect(`/study/new?mode=review&source=${data.source}&empty=1`);
  }

  const picked = shuffle(usable).slice(0, data.questionLimit ?? usable.length);
  const chapterIds = [...new Set(picked.flatMap((q) => q.chapterIds))];

  const baseName = data.name?.trim() || withDate(reviewQuizBaseName(data.source, locale));
  const existing = await db.quiz.findMany({ where: { userId: me.id }, select: { name: true } });
  const names = new Set(existing.map((q) => q.name));
  let name = baseName;
  for (let i = 2; names.has(name); i++) name = `${baseName} (${i})`;

  const quiz = await db.quiz.create({
    data: { userId: me.id, name, chapterIds, questionIds: picked.map((q) => q.id) },
  });
  redirect(`/quiz/${quiz.id}`);
}

/**
 * Record an answer given outside a quiz (re-testing on the question page or
 * the Saved tab). It counts as the latest attempt, so answering a mistake
 * correctly moves it off the "Got wrong" list.
 */
export async function recordStandaloneAttemptAction(input: {
  questionId: number;
  chosen: "A" | "B" | "C" | "D";
}): Promise<{ isCorrect: boolean }> {
  const me = await requireUser();
  return recordStandaloneAttempt(me, input);
}
