"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getTranslatedFields } from "@/lib/translate";

export async function batchUpdateSourceAction(ids: number[], source: string | null) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db.question.updateMany({
    where: { id: { in: ids } },
    data: { source: source ?? null },
  });
  revalidatePath("/admin/questions");
}

export async function batchDeleteQuestionsAction(ids: number[]) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db.question.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/admin/questions");
}

/**
 * For each supplied question id, translate any missing EN fields
 * (stem + options, and explanation + whyOthersWrong if a GeminiAnswer exists).
 * Already-cached fields are served from cache and cost no Gemini call.
 * Returns the number of questions processed.
 */
export async function batchTranslateMissingAction(ids: number[]): Promise<number> {
  await requireAdmin();
  if (ids.length === 0) return 0;

  const questions = await db.question.findMany({
    where: { id: { in: ids } },
    include: { geminiAnswer: true },
  });

  // Run sequentially to avoid hammering the Gemini API
  for (const q of questions) {
    await Promise.all([
      getTranslatedFields(
        "Question",
        String(q.id),
        { stem: q.stem, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD },
        "en",
      ),
      q.geminiAnswer
        ? getTranslatedFields(
            "GeminiAnswer",
            String(q.geminiAnswer.id),
            { explanation: q.geminiAnswer.explanation, whyOthersWrong: q.geminiAnswer.whyOthersWrong },
            "en",
          )
        : Promise.resolve(),
    ]);
  }

  revalidatePath("/admin/questions");
  return questions.length;
}
