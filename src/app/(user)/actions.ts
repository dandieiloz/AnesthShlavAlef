"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Choice } from "@prisma/client";
import { ProfileSchema } from "@/app/onboarding/schema";

export async function updateProfileAction(formData: FormData) {
  const me = await requireUser();
  const data = ProfileSchema.parse({
    fullName: formData.get("fullName"),
    hospitalName: formData.get("hospitalName"),
    residencyYear: formData.get("residencyYear"),
  });
  await db.user.update({
    where: { id: me.id },
    data,
  });
  revalidatePath("/profile");
}

const QuizSchema = z.object({
  name: z.string().min(1).max(80),
  chapterIds: z.array(z.coerce.number()).min(1),
});

export async function createQuizAction(formData: FormData) {
  const me = await requireUser();
  const data = QuizSchema.parse({
    name: formData.get("name") || "מבחן",
    chapterIds: formData.getAll("chapterIds").map(String),
  });
  const quiz = await db.quiz.create({
    data: { userId: me.id, name: data.name, chapterIds: data.chapterIds },
  });
  redirect(`/quiz/${quiz.id}`);
}

const AttemptSchema = z.object({
  quizId: z.coerce.number(),
  questionId: z.coerce.number(),
  chosen: z.enum(["A", "B", "C", "D"]),
});

export async function submitAttemptAction(formData: FormData) {
  const me = await requireUser();
  const data = AttemptSchema.parse({
    quizId: formData.get("quizId"),
    questionId: formData.get("questionId"),
    chosen: formData.get("chosen"),
  });
  const q = await db.question.findUnique({
    where: { id: data.questionId },
    include: { geminiAnswer: true },
  });
  if (!q?.geminiAnswer) throw new Error("No cached answer for question");
  await db.attempt.create({
    data: {
      userId: me.id,
      quizId: data.quizId,
      questionId: data.questionId,
      chosen: data.chosen as Choice,
      isCorrect: data.chosen === q.geminiAnswer.correctAnswer,
    },
  });
  revalidatePath(`/quiz/${data.quizId}`);
}

const CommentSchema = z.object({
  questionId: z.coerce.number(),
  body: z.string().min(1).max(2000),
});

export async function postCommentAction(formData: FormData) {
  const me = await requireUser();
  const data = CommentSchema.parse({
    questionId: formData.get("questionId"),
    body: formData.get("body"),
  });
  await db.comment.create({
    data: { userId: me.id, questionId: data.questionId, body: data.body },
  });
  revalidatePath(`/quiz`);
}

const ReportSchema = z.object({
  questionId: z.coerce.number(),
  explanation: z.string().min(10).max(2000),
});

export async function reportAnswerAction(formData: FormData) {
  const me = await requireUser();
  const data = ReportSchema.parse({
    questionId: formData.get("questionId"),
    explanation: formData.get("explanation"),
  });
  await db.answerReport.create({
    data: { userId: me.id, questionId: data.questionId, explanation: data.explanation },
  });
  revalidatePath(`/quiz`);
}

// ── Bookmarks ────────────────────────────────────────────────────────────────

const BookmarkSchema = z.object({ questionId: z.coerce.number() });

export async function toggleBookmarkAction(formData: FormData) {
  const me = await requireUser();
  const { questionId } = BookmarkSchema.parse({ questionId: formData.get("questionId") });
  const existing = await db.bookmark.findUnique({
    where: { userId_questionId: { userId: me.id, questionId } },
    select: { id: true },
  });
  if (existing) {
    await db.bookmark.delete({ where: { id: existing.id } });
  } else {
    await db.bookmark.create({ data: { userId: me.id, questionId } });
  }
  revalidatePath("/bookmarks");
  revalidatePath("/dashboard");
}

// ── Quizzes ───────────────────────────────────────────────────────────────────

const DeleteQuizSchema = z.object({ quizId: z.coerce.number() });

export async function deleteQuizAction(formData: FormData) {
  const me = await requireUser();
  const { quizId } = DeleteQuizSchema.parse({ quizId: formData.get("quizId") });
  // Verify ownership before deleting
  const quiz = await db.quiz.findFirst({ where: { id: quizId, userId: me.id }, select: { id: true } });
  if (!quiz) return; // silently ignore if not owned by user
  await db.quiz.delete({ where: { id: quizId } });
  revalidatePath("/quizzes");
  revalidatePath("/study");
}
