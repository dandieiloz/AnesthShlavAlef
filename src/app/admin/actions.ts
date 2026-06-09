"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { invalidateTranslations } from "@/lib/translate";
import { uploadQuestionImage, deleteQuestionImage, ImageValidationError } from "@/lib/question-image";

const QuestionSchema = z.object({
  id: z.coerce.number().optional(),
  chapterNumber: z.coerce.number(),
  stem: z.string().min(3),
  optionA: z.string().min(1),
  optionB: z.string().min(1),
  optionC: z.string().min(1),
  optionD: z.string().min(1),
  correctAnswer: z.enum(["A", "B", "C", "D"]).optional(),
  // Additional choices that are also accepted as correct alongside `correctAnswer`.
  // The primary correctAnswer is always implicitly accepted and is filtered out of this array on save.
  acceptedAnswers: z.array(z.enum(["A", "B", "C", "D"])).default([]),
  source: z.string().optional(),
});

export async function saveQuestionAction(formData: FormData) {
  const me = await requireAdmin();
  const rawCorrectAnswer = formData.get("correctAnswer");
  const rawAcceptedAnswers = formData.getAll("acceptedAnswers").map((v) => String(v));
  const data = QuestionSchema.parse({
    id: formData.get("id") || undefined,
    chapterNumber: formData.get("chapterNumber"),
    stem: formData.get("stem"),
    optionA: formData.get("optionA"),
    optionB: formData.get("optionB"),
    optionC: formData.get("optionC"),
    optionD: formData.get("optionD"),
    correctAnswer: rawCorrectAnswer || undefined,
    acceptedAnswers: rawAcceptedAnswers,
    source: (() => {
      const inst = ((formData.get("sourceInstitution") as string) || "").trim();
      const yr = ((formData.get("sourceYear") as string) || "").trim();
      const grp = ((formData.get("sourceGroup") as string) || "").trim();
      return inst && yr
        ? grp ? `${inst} ${yr} ${grp}` : `${inst} ${yr}`
        : inst || yr || undefined;
    })(),
  });
  // Defensive: never store the primary correct answer inside `acceptedAnswers`,
  // and de-duplicate. The primary is always implicitly accepted at validation time.
  const acceptedAnswers = Array.from(
    new Set(data.acceptedAnswers.filter((c) => c !== data.correctAnswer)),
  );
  const chapter = await db.chapter.findUnique({ where: { number: data.chapterNumber } });
  if (!chapter) throw new Error("Chapter not found");

  if (data.id) {
    // Fetch existing values so we only invalidate translations for fields that actually changed,
    // and so we can decide whether to re-score past attempts.
    const existing = await db.question.findUnique({
      where: { id: data.id },
      select: {
        stem: true,
        optionA: true,
        optionB: true,
        optionC: true,
        optionD: true,
        correctAnswer: true,
        acceptedAnswers: true,
        geminiAnswer: { select: { correctAnswer: true } },
      },
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
        acceptedAnswers,
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
      // Retroactive re-score: if the accepted set OR the primary changed, fix
      // existing Attempt rows so historical stats reflect the new ruling.
      const prevPrimary = existing.geminiAnswer?.correctAnswer ?? existing.correctAnswer ?? null;
      const newPrimary = existing.geminiAnswer?.correctAnswer ?? (data.correctAnswer ?? null);
      const prevSet = new Set<string>([
        ...(prevPrimary ? [prevPrimary] : []),
        ...existing.acceptedAnswers,
      ]);
      const nextSet = new Set<string>([
        ...(newPrimary ? [newPrimary] : []),
        ...acceptedAnswers,
      ]);
      const setsEqual =
        prevSet.size === nextSet.size && [...prevSet].every((c) => nextSet.has(c));
      if (!setsEqual && newPrimary) {
        const acceptedList = [...nextSet] as ("A" | "B" | "C" | "D")[];
        await db.attempt.updateMany({
          where: { questionId: data.id, chosen: { in: acceptedList } },
          data: { isCorrect: true },
        });
        await db.attempt.updateMany({
          where: { questionId: data.id, chosen: { notIn: acceptedList } },
          data: { isCorrect: false },
        });
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
        acceptedAnswers,
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

export async function regenerateExplanationAction(questionId: number, hint?: string | null) {
  await requireAdmin();
  // Guard: don't enqueue if an open job already exists
  const existing = await db.answerGenerationJob.findFirst({
    where: { questionId, status: { in: ["PENDING", "PROCESSING"] } },
  });
  if (!existing) {
    const trimmed = hint?.trim().slice(0, 2000) || null;
    await db.answerGenerationJob.create({
      data: { questionId, kind: "REGENERATE", regenerationHint: trimmed },
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

const EvidenceCitationSchema = z.object({
  chapterNumber: z.coerce.number().int().positive(),
  chapterTitle: z.string().default(""),
  sectionPath: z.string().nullable().optional().transform((v) => (v && v.trim() ? v : null)),
  quote: z.string().min(1),
  pageStart: z.coerce.number().int().positive().nullable().optional(),
  pageEnd: z.coerce.number().int().positive().nullable().optional(),
});

const SaveGeminiAnswerSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  explanation: z.string().min(1),
  whyOthersWrong: z.string().min(1),
  evidenceCitationsJson: z.string(),
});

export async function saveGeminiAnswerFieldsAction(formData: FormData) {
  await requireAdmin();
  const data = SaveGeminiAnswerSchema.parse({
    questionId: formData.get("questionId"),
    explanation: formData.get("explanation"),
    whyOthersWrong: formData.get("whyOthersWrong"),
    evidenceCitationsJson: formData.get("evidenceCitationsJson") ?? "[]",
  });
  let parsedCitations: z.infer<typeof EvidenceCitationSchema>[];
  try {
    const raw = JSON.parse(data.evidenceCitationsJson);
    if (!Array.isArray(raw)) throw new Error("evidenceCitations must be an array");
    parsedCitations = raw.map((c) => EvidenceCitationSchema.parse(c));
  } catch (e) {
    throw new Error(`Invalid evidence citations: ${(e as Error).message}`);
  }
  const existing = await db.geminiAnswer.findUnique({
    where: { questionId: data.questionId },
    select: { id: true, explanation: true, whyOthersWrong: true, explanationImagePath: true },
  });
  if (!existing) throw new Error("No GeminiAnswer to edit for this question");

  // Optional explanation image: upload a new file, remove the current one, or
  // leave it untouched. Alt text is always synced from the form.
  const explanationImageAlt = String(formData.get("explanationImageAlt") ?? "").trim() || null;
  const removeExplanationImage = formData.get("removeExplanationImage") === "1";
  const explanationImageFile = formData.get("explanationImage");
  const imageData: {
    explanationImageUrl?: string | null;
    explanationImagePath?: string | null;
    explanationImageAlt: string | null;
  } = { explanationImageAlt };

  if (explanationImageFile instanceof File && explanationImageFile.size > 0) {
    try {
      const uploaded = await uploadQuestionImage(explanationImageFile, "explanations");
      imageData.explanationImageUrl = uploaded.url;
      imageData.explanationImagePath = uploaded.path;
    } catch (e) {
      if (e instanceof ImageValidationError) throw e;
      throw new Error(`העלאת התמונה נכשלה: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (existing.explanationImagePath) await deleteQuestionImage(existing.explanationImagePath);
  } else if (removeExplanationImage) {
    imageData.explanationImageUrl = null;
    imageData.explanationImagePath = null;
    imageData.explanationImageAlt = null;
    if (existing.explanationImagePath) await deleteQuestionImage(existing.explanationImagePath);
  }

  await db.geminiAnswer.update({
    where: { id: existing.id },
    data: {
      explanation: data.explanation,
      whyOthersWrong: data.whyOthersWrong,
      evidenceCitations: parsedCitations,
      ...imageData,
    },
  });
  const changed: string[] = [];
  if (existing.explanation !== data.explanation) changed.push("explanation");
  if (existing.whyOthersWrong !== data.whyOthersWrong) changed.push("whyOthersWrong");
  if (changed.length > 0) {
    await invalidateTranslations("GeminiAnswer", String(existing.id), changed);
  }
  revalidatePath(`/admin/questions/${data.questionId}`);
}

const AdminNoteSchema = z.object({
  questionId: z.coerce.number().int().positive(),
  body: z.string().trim().min(1).max(4000),
});

export async function addAdminNoteAction(formData: FormData) {
  const me = await requireAdmin();
  const data = AdminNoteSchema.parse({
    questionId: formData.get("questionId"),
    body: formData.get("body"),
  });
  await db.questionAdminNote.create({
    data: { questionId: data.questionId, body: data.body, authorId: me.id },
  });
  revalidatePath(`/admin/questions/${data.questionId}`);
}

export async function deleteAdminNoteAction(formData: FormData) {
  await requireAdmin();
  const noteId = Number(formData.get("noteId"));
  if (!Number.isFinite(noteId)) throw new Error("Invalid noteId");
  const note = await db.questionAdminNote.delete({ where: { id: noteId } });
  revalidatePath(`/admin/questions/${note.questionId}`);
}
