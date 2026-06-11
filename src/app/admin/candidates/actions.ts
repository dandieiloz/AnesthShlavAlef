"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { invalidateTranslations } from "@/lib/translate";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

export type CandidateActionResult = { ok: true } | { ok: false; error: string };

/**
 * Replace the live GeminiAnswer with the staged candidate. Translations of
 * the old answer are invalidated (the new GeminiAnswer.id breaks foreign refs
 * for cached translations that keyed on the old id). Chapter retag (deferred
 * during staging) is applied here when the question is still auto-tagged.
 */
export async function acceptCandidateAction(questionId: number): Promise<CandidateActionResult> {
  await requireAdmin();
  const candidate = await db.geminiAnswerCandidate.findUnique({ where: { questionId } });
  if (!candidate) return { ok: false, error: "אין מועמד פעיל לשאלה זו" };
  const question = await db.question.findUnique({
    where: { id: questionId },
    select: { chapterAutoTagged: true, geminiAnswer: { select: { id: true } } },
  });
  if (!question) return { ok: false, error: "השאלה לא נמצאה" };

  if (question.geminiAnswer) {
    await invalidateTranslations("GeminiAnswer", String(question.geminiAnswer.id));
  }

  await db.$transaction(async (tx) => {
    if (question.geminiAnswer) {
      await tx.geminiAnswer.delete({ where: { questionId } });
    }
    await tx.geminiAnswer.create({
      data: {
        questionId,
        rawMarkdown: candidate.rawMarkdown,
        correctAnswer: candidate.correctAnswer,
        evidence: candidate.evidence,
        explanation: candidate.explanation,
        whyOthersWrong: candidate.whyOthersWrong,
        model: candidate.model,
        sourceChapters: candidate.sourceChapters,
        evidenceCitations: (candidate.evidenceCitations ?? undefined) as Prisma.InputJsonValue | undefined,
        confidence: candidate.confidence,
        escalated: candidate.escalated,
        insufficientEvidence: candidate.insufficientEvidence,
      },
    });
    if (question.chapterAutoTagged && candidate.derivedChapterIds.length > 0) {
      await tx.question.update({
        where: { id: questionId },
        data: {
          chapterIds: candidate.derivedChapterIds,
          ...(candidate.primaryChapterId !== null ? { chapterId: candidate.primaryChapterId } : {}),
        },
      });
    }
    await tx.geminiAnswerCandidate.delete({ where: { questionId } });
  });

  revalidatePath("/admin/candidates");
  revalidatePath("/admin/queue");
  revalidatePath(`/history/${questionId}`);
  return { ok: true };
}

export async function discardCandidateAction(questionId: number): Promise<CandidateActionResult> {
  await requireAdmin();
  const deleted = await db.geminiAnswerCandidate.deleteMany({ where: { questionId } });
  if (deleted.count === 0) return { ok: false, error: "אין מועמד פעיל לשאלה זו" };
  revalidatePath("/admin/candidates");
  revalidatePath(`/history/${questionId}`);
  return { ok: true };
}

export async function acceptAllCandidatesAction(
  questionIds: number[],
): Promise<{ accepted: number; failed: number }> {
  await requireAdmin();
  let accepted = 0;
  let failed = 0;
  for (const qid of questionIds) {
    const r = await acceptCandidateAction(qid);
    if (r.ok) accepted++;
    else failed++;
  }
  revalidatePath("/admin/candidates");
  return { accepted, failed };
}

export async function discardAllCandidatesAction(questionIds: number[]): Promise<number> {
  await requireAdmin();
  if (questionIds.length === 0) return 0;
  const result = await db.geminiAnswerCandidate.deleteMany({
    where: { questionId: { in: questionIds } },
  });
  revalidatePath("/admin/candidates");
  return result.count;
}
