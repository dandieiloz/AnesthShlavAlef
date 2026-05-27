"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { invalidateTranslations } from "@/lib/translate";

const QuestionSchema = z.object({
  id: z.coerce.number().optional(),
  chapterNumber: z.coerce.number(),
  stem: z.string().min(3),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().min(1),
  optionD: z.string().min(1),
  correctAnswer: z.enum(["A", "B", "C", "D"]).optional(),
  source: z.string().optional(),
});

export async function saveQuestionAction(formData: FormData) {
  const me = await requireAdmin();
  const rawCorrectAnswer = formData.get("correctAnswer");
  const data = QuestionSchema.parse({
    id: formData.get("id") || undefined,
    chapterNumber: formData.get("chapterNumber"),
    stem: formData.get("stem"),
    optionA: formData.get("optionA"),
    optionB: formData.get("optionB"),
    optionC: formData.get("optionC"),
    optionD: formData.get("optionD"),
    correctAnswer: rawCorrectAnswer || undefined,
    source: (() => {
      const inst = ((formData.get("sourceInstitution") as string) || "").trim();
      const yr = ((formData.get("sourceYear") as string) || "").trim();
      return inst && yr ? `${inst} ${yr}` : inst || yr || undefined;
    })(),
  });
  const chapter = await db.chapter.findUnique({ where: { number: data.chapterNumber } });
  if (!chapter) throw new Error("Chapter not found");

  if (data.id) {
    // Fetch existing values so we only invalidate translations for fields that actually changed.
    const existing = await db.question.findUnique({
      where: { id: data.id },
      select: { stem: true, optionA: true, optionB: true, optionC: true, optionD: true },
    });
    await db.question.update({
      where: { id: data.id },
      data: {
        stem: data.stem,
        optionA: data.optionA,
        optionB: data.optionB,
        optionC: data.optionC,
        optionD: data.optionD,
        correctAnswer: data.correctAnswer ?? null,
        source: data.source ?? null,
      },
    });
    if (existing) {
      const changed: string[] = [];
      if (existing.stem !== data.stem) changed.push("stem");
      if (existing.optionA !== data.optionA) changed.push("optionA");
      if (existing.optionB !== data.optionB) changed.push("optionB");
      if (existing.optionC !== data.optionC) changed.push("optionC");
      if (existing.optionD !== data.optionD) changed.push("optionD");
      if (changed.length > 0) {
        await invalidateTranslations("Question", String(data.id), changed);
      }
    }
    revalidatePath(`/admin/questions/${data.id}`);
    redirect(`/admin/questions/${data.id}`);
  } else {
    const created = await db.question.create({
      data: {
        chapterId: chapter.id,
        stem: data.stem,
        optionA: data.optionA,
        optionB: data.optionB,
        optionC: data.optionC,
        optionD: data.optionD,
        correctAnswer: data.correctAnswer ?? null,
        source: data.source ?? null,
        createdById: me.id,
      },
    });
    // Auto-enqueue an INITIAL generation job (consistent with the wizard flow)
    await db.answerGenerationJob.create({
      data: { questionId: created.id, kind: "INITIAL", createdById: me.id },
    });
    revalidatePath(`/admin/chapters/${chapter.number}/questions`);
    revalidatePath(`/admin/queue`);
    redirect(`/admin/questions/${created.id}`);
  }
}

export async function generateExplanationAction(questionId: number) {
  await requireAdmin();
  // Guard: don't enqueue if an open job already exists
  const existing = await db.answerGenerationJob.findFirst({
    where: { questionId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (!existing) {
    await db.answerGenerationJob.create({
      data: { questionId, kind: "INITIAL" },
    });
  }
  revalidatePath(`/admin/questions/${questionId}`);
}

export async function regenerateExplanationAction(questionId: number) {
  await requireAdmin();
  // Guard: don't enqueue if an open job already exists
  const existing = await db.answerGenerationJob.findFirst({
    where: { questionId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (!existing) {
    await db.answerGenerationJob.create({
      data: { questionId, kind: "REGENERATE" },
    });
  }
  revalidatePath(`/admin/questions/${questionId}`);
}

export async function deleteQuestionAction(questionId: number) {
  await requireAdmin();
  const q = await db.question.findUnique({
    where: { id: questionId },
    include: { chapter: true, geminiAnswer: { select: { id: true } } },
  });
  if (!q) return;
  // Remove cached translations for the question and its answer (FK cascade only handles app data).
  await invalidateTranslations("Question", String(questionId));
  if (q.geminiAnswer) {
    await invalidateTranslations("GeminiAnswer", String(q.geminiAnswer.id));
  }
  await db.question.delete({ where: { id: questionId } });
  redirect(`/admin/chapters/${q.chapter.number}/questions`);
}

/**
 * Admin override for the question's chapter tagging.
 * Flips `chapterAutoTagged = false` so future RAG runs do NOT overwrite the choice.
 */
export async function updateQuestionChaptersAction(formData: FormData) {
  await requireAdmin();
  const questionId = Number(formData.get("questionId"));
  const primaryNumber = Number(formData.get("primaryChapterNumber"));
  // chapterNumbers comes in as a comma-separated string from the hidden input
  const raw = String(formData.get("chapterNumbers") ?? "").trim();
  const numbers = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!Number.isFinite(questionId) || !Number.isFinite(primaryNumber) || numbers.length === 0) {
    throw new Error("Invalid chapter override payload");
  }
  const chapters = await db.chapter.findMany({
    where: { number: { in: [...new Set([primaryNumber, ...numbers])] } },
    select: { id: true, number: true },
  });
  const idByNumber = new Map(chapters.map((c) => [c.number, c.id]));
  const primaryId = idByNumber.get(primaryNumber);
  if (!primaryId) throw new Error(`Primary chapter ${primaryNumber} not found`);
  const chapterIds = numbers
    .map((n) => idByNumber.get(n))
    .filter((x): x is number => typeof x === "number");
  // Ensure primary is in chapterIds[]
  if (!chapterIds.includes(primaryId)) chapterIds.unshift(primaryId);
  await db.question.update({
    where: { id: questionId },
    data: {
      chapterId: primaryId,
      chapterIds: [...new Set(chapterIds)],
      chapterAutoTagged: false,
    },
  });
  revalidatePath(`/admin/questions/${questionId}`);
}

/** Re-enable auto-tagging — the next RAG regeneration will overwrite the chapter assignment. */
export async function resetChapterAutoTagAction(questionId: number) {
  await requireAdmin();
  await db.question.update({
    where: { id: questionId },
    data: { chapterAutoTagged: true },
  });
  revalidatePath(`/admin/questions/${questionId}`);
}
