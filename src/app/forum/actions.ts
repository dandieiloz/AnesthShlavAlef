"use server";
import { requireCompletedProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { rateLimit } from "@/lib/rate-limit";
import { createThread, createReply, deleteThread, deleteReply } from "@/lib/forum";
import { getDictionary } from "@/lib/i18n";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere } from "@/lib/plan";
import { getAnswerDistribution } from "@/lib/answer-distribution";
import type { EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import type { HighlightRecord } from "@/components/HighlightableMarkdown";

export type ForumActionResult = { ok: true; threadId?: string } | { ok: false; error: string };

export type ForumReplyView = {
  id: string;
  body: string;
  authorId: string;
  createdAt: Date;
  editedAt: Date | null;
  author: { name: string | null; image: string | null; hospitalName: string | null };
};

/** Load a thread's replies for inline expansion on the forum list. */
export async function loadThreadRepliesAction(threadId: string): Promise<ForumReplyView[]> {
  await requireCompletedProfile();
  if (!threadId) return [];
  return db.forumReply.findMany({
    where: { threadId },
    include: { author: { select: { name: true, image: true, hospitalName: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export type ForumQuestionView = {
  questionId: number;
  locale: "he" | "en";
  stem: string;
  letters: string[];
  optionTexts: [string, string, string, string];
  rawOptions: [string, string, string, string];
  correctAnswer: "A" | "B" | "C" | "D";
  acceptedAnswers: ("A" | "B" | "C" | "D")[];
  imageUrl: string | null;
  imageAlt: string | null;
  videoUrl: string | null;
  detailedExplanationLabel: string;
  noExplanationText: string;
  userChoice: "A" | "B" | "C" | "D" | undefined;
  highlights: HighlightRecord[];
  highlightT: ReturnType<typeof getDictionary>["highlights"];
  answerDistribution: { A: number; B: number; C: number; D: number };
  answer: {
    explanation: string;
    evidenceCitations: EvidenceCitationDisplay[] | null;
    whyOthersWrong: string;
    insufficientEvidence: boolean;
    explanationImageUrl: string | null;
    explanationImageAlt: string | null;
  } | null;
};

/** Load the full question (options + explanation), plan-gated, for inline display on the forum. */
export async function loadThreadQuestionAction(questionId: number): Promise<ForumQuestionView | null> {
  const me = await requireCompletedProfile();
  const [uiLocale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const dict = getDictionary(uiLocale);

  const gate = await questionAccessWhere(me);
  const question = await db.question.findFirst({
    where: { id: questionId, AND: [gate] },
    include: {
      chapter: { select: { number: true, title: true } },
      geminiAnswer: true,
    },
  });
  if (!question) return null;

  const [qT, attempt, highlights] = await Promise.all([
    getTranslatedFields(
      "Question",
      String(question.id),
      {
        stem: question.stem,
        optionA: question.optionA,
        optionB: question.optionB,
        optionC: question.optionC,
        optionD: question.optionD,
        chapterTitle: question.chapter.title,
      },
      contentLocale,
    ),
    db.attempt.findFirst({
      where: { userId: me.id, questionId: question.id },
      orderBy: { createdAt: "desc" },
      select: { chosen: true },
    }),
    db.sentenceHighlight.findMany({
      where: { userId: me.id, locale: contentLocale, questionId: question.id },
      select: { id: true, questionId: true, section: true, sentenceIndex: true, colorId: true, sentenceHash: true, note: true },
    }),
  ]);

  const answerDistribution = await getAnswerDistribution(question.id);

  const letters = dict.review.labels[contentLocale] ?? ["A", "B", "C", "D"];
  const correctAnswer = question.geminiAnswer?.correctAnswer ?? question.correctAnswer;

  return {
    questionId: question.id,
    locale: contentLocale,
    stem: qT.stem,
    letters,
    optionTexts: [qT.optionA, qT.optionB, qT.optionC, qT.optionD],
    rawOptions: [question.optionA, question.optionB, question.optionC, question.optionD],
    correctAnswer: correctAnswer as "A" | "B" | "C" | "D",
    acceptedAnswers: question.acceptedAnswers as ("A" | "B" | "C" | "D")[],
    imageUrl: question.imageUrl,
    imageAlt: question.imageAlt,
    videoUrl: question.videoUrl,
    detailedExplanationLabel: dict.review.detailedExplanation,
    noExplanationText: "עדיין אין הסבר זמין לשאלה זו.",
    userChoice: attempt?.chosen ?? undefined,
    highlights: highlights as HighlightRecord[],
    highlightT: dict.highlights,
    answerDistribution,
    answer: question.geminiAnswer
      ? {
          explanation: question.geminiAnswer.explanation,
          evidenceCitations: question.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null,
          whyOthersWrong: question.geminiAnswer.whyOthersWrong,
          insufficientEvidence: question.geminiAnswer.insufficientEvidence,
          explanationImageUrl: question.geminiAnswer.explanationImageUrl,
          explanationImageAlt: question.geminiAnswer.explanationImageAlt,
        }
      : null,
  };
}

const MAX_TITLE = 200;
const MAX_BODY = 5000;
const MAX_REPLY = 2000;

// Anti-abuse: at most 10 posts per 10 minutes per user.
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function str(v: FormDataEntryValue | null): string {
  return (typeof v === "string" ? v : "").trim();
}

export async function createThreadAction(formData: FormData): Promise<ForumActionResult> {
  const me = await requireCompletedProfile();
  const t = getDictionary(await getLocale()).forum;

  const limited = rateLimit(`forum:user:${me.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) {
    return { ok: false, error: t.rateLimited(Math.max(1, Math.ceil(limited.retryAfterSeconds / 60))) };
  }

  const title = str(formData.get("title")).slice(0, MAX_TITLE);
  if (!title) return { ok: false, error: t.titleRequired };
  const body = str(formData.get("body")).slice(0, MAX_BODY) || null;

  const thread = await createThread(me.id, title, body);
  revalidatePath("/forum");
  return { ok: true, threadId: thread.id };
}

export async function createReplyAction(formData: FormData): Promise<ForumActionResult> {
  const me = await requireCompletedProfile();
  const t = getDictionary(await getLocale()).forum;

  const limited = rateLimit(`forum:user:${me.id}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!limited.ok) {
    return { ok: false, error: t.rateLimited(Math.max(1, Math.ceil(limited.retryAfterSeconds / 60))) };
  }

  const threadId = str(formData.get("threadId"));
  const body = str(formData.get("body")).slice(0, MAX_REPLY);
  if (!threadId || !body) return { ok: false, error: t.bodyRequired };

  await createReply(threadId, me.id, body);
  revalidatePath("/forum");
  revalidatePath(`/forum/${threadId}`);
  // A question thread's replies also appear on the question pages.
  revalidatePath("/quiz/[id]/review", "page");
  revalidatePath("/history/[id]", "page");
  return { ok: true };
}

export async function deleteThreadAction(formData: FormData): Promise<void> {
  const me = await requireCompletedProfile();
  const threadId = str(formData.get("threadId"));
  await deleteThread(threadId, me.id, me.role);
  revalidatePath("/forum");
  // A question thread's discussion also appears on the question pages.
  revalidatePath("/quiz/[id]/review", "page");
  revalidatePath("/history/[id]", "page");
  redirect("/forum");
}

export async function deleteReplyAction(formData: FormData): Promise<void> {
  const me = await requireCompletedProfile();
  const replyId = str(formData.get("replyId"));
  const deleted = await deleteReply(replyId, me.id, me.role);
  revalidatePath("/forum");
  if (deleted) revalidatePath(`/forum/${deleted.threadId}`);
  revalidatePath("/quiz/[id]/review", "page");
  revalidatePath("/history/[id]", "page");
}
