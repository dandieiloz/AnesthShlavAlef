import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCompletedProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere } from "@/lib/plan";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CommentItem } from "@/components/CommentItem";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { QuestionImage } from "@/components/QuestionImage";
import { QuestionVideo } from "@/components/QuestionVideo";
import { ReplyForm } from "../ReplyForm";
import { DeleteThreadButton } from "../DeleteThreadButton";
import { ArrowRight, FileQuestion, MessageSquare, BookOpen, CheckCircle2 } from "lucide-react";

export const metadata: Metadata = {
  title: "פורום",
};

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default async function ForumThreadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireCompletedProfile();
  const [locale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const dict = getDictionary(locale);
  const t = dict.forum;
  const rev = dict.review;

  const thread = await db.forumThread.findUnique({
    where: { id },
    include: {
      question: { select: { id: true, stem: true } },
      author: { select: { name: true } },
      replies: {
        include: { author: { select: { name: true, image: true, hospitalName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!thread) notFound();

  const isQuestion = thread.questionId !== null;
  const canDeleteThread =
    !isQuestion && (thread.authorId === me.id || me.role === "ADMIN");

  // For question threads, load the full question (respecting the user's plan gate)
  // so the answer options and explanation can be shown inline.
  let questionView: {
    question: NonNullable<Awaited<ReturnType<typeof loadThreadQuestion>>["question"]>;
    qT: NonNullable<Awaited<ReturnType<typeof loadThreadQuestion>>["qT"]>;
    userChoice: Awaited<ReturnType<typeof loadThreadQuestion>>["userChoice"];
    highlightRows: Awaited<ReturnType<typeof loadThreadQuestion>>["highlightRows"];
  } | null = null;

  if (thread.questionId !== null) {
    const loaded = await loadThreadQuestion(me, thread.questionId, contentLocale);
    if (loaded.question) {
      questionView = {
        question: loaded.question,
        qT: loaded.qT!,
        userChoice: loaded.userChoice,
        highlightRows: loaded.highlightRows,
      };
    }
  }

  const letters = rev.labels[contentLocale] ?? ["A", "B", "C", "D"];

  return (
    <div className="mx-auto max-w-3xl space-y-5 animate-fade-in">
      <Button asChild variant="ghost" size="sm" className="gap-1.5 -ms-2">
        <Link href="/forum">
          <ArrowRight className="h-3.5 w-3.5" />
          {t.backToForum}
        </Link>
      </Button>

      {/* Topic header */}
      <Card>
        <CardContent className="p-5 space-y-3" dir={isQuestion && contentLocale === "he" ? "rtl" : undefined}>
          {isQuestion ? (
            <>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <FileQuestion className="h-3 w-3" />
                {t.questionBadge}
              </Badge>
              <p className="text-base font-semibold whitespace-pre-wrap leading-snug [unicode-bidi:plaintext]" dir="auto">
                {questionView?.qT.stem ?? thread.question?.stem}
              </p>

              {questionView ? (
                <>
                  <QuestionImage url={questionView.question.imageUrl} alt={questionView.question.imageAlt} />
                  <QuestionVideo url={questionView.question.videoUrl} />

                  {/* Given answers */}
                  <div className="space-y-1.5">
                    {OPTION_KEYS.map((k, idx) => {
                      const correctAnswer =
                        questionView!.question.geminiAnswer?.correctAnswer ??
                        questionView!.question.correctAnswer;
                      const isCorrect =
                        correctAnswer === k || questionView!.question.acceptedAnswers.includes(k);
                      const optionTexts = [
                        questionView!.qT.optionA,
                        questionView!.qT.optionB,
                        questionView!.qT.optionC,
                        questionView!.qT.optionD,
                      ];
                      const rowClass = isCorrect
                        ? "flex items-start gap-2.5 rounded-lg border border-success/50 bg-success/10 p-2.5 text-sm"
                        : "flex items-start gap-2.5 rounded-lg border border-border bg-background p-2.5 text-sm text-muted-foreground";
                      const letterClass = isCorrect
                        ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5 bg-success text-white"
                        : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5 bg-muted text-muted-foreground";
                      return (
                        <div key={k} className={rowClass}>
                          <span className={letterClass}>{letters[idx]}</span>
                          <span dir="auto" className="flex-1 leading-snug [unicode-bidi:plaintext]">
                            {optionTexts[idx]}
                          </span>
                          {isCorrect && (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Inline explanation disclosure */}
                  {questionView.question.geminiAnswer ? (
                    <details className="group">
                      <summary className="inline-flex w-fit cursor-pointer select-none items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted [&::-webkit-details-marker]:hidden">
                        <BookOpen className="h-3.5 w-3.5" />
                        {t.open}
                      </summary>
                      <div className="mt-3 space-y-3">
                        <Separator className="opacity-40" />
                        <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" />
                          {rev.detailedExplanation}
                        </div>
                        <AnswerExplanation
                          explanation={questionView.question.geminiAnswer.explanation}
                          evidenceCitations={questionView.question.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null}
                          whyOthersWrong={questionView.question.geminiAnswer.whyOthersWrong}
                          correctAnswer={questionView.question.geminiAnswer.correctAnswer}
                          acceptedAnswers={questionView.question.acceptedAnswers}
                          userChoice={questionView.userChoice}
                          options={[
                            { key: "A", text: questionView.question.optionA },
                            { key: "B", text: questionView.question.optionB },
                            { key: "C", text: questionView.question.optionC },
                            { key: "D", text: questionView.question.optionD },
                          ]}
                          insufficientEvidence={questionView.question.geminiAnswer.insufficientEvidence}
                          explanationImageUrl={questionView.question.geminiAnswer.explanationImageUrl}
                          explanationImageAlt={questionView.question.geminiAnswer.explanationImageAlt}
                          locale={contentLocale}
                          questionId={questionView.question.id}
                          highlights={questionView.highlightRows}
                          highlightT={dict.highlights}
                        />
                      </div>
                    </details>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      עדיין אין הסבר זמין לשאלה זו.
                    </p>
                  )}
                </>
              ) : (
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link href={`/history/${thread.questionId}`}>{t.viewQuestion}</Link>
                </Button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl font-bold" dir="auto">
                  {thread.title}
                </h1>
                {canDeleteThread && (
                  <DeleteThreadButton
                    threadId={thread.id}
                    label={t.deleteTopic}
                    confirmText={t.deleteConfirm}
                  />
                )}
              </div>
              {thread.author?.name && (
                <p className="text-[11px] text-muted-foreground">{thread.author.name}</p>
              )}
              {thread.body && (
                <p className="text-sm whitespace-pre-wrap leading-relaxed" dir="auto">
                  {thread.body}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Replies */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <MessageSquare className="h-3.5 w-3.5" />
          {t.replyCount(thread.replies.length)}
        </h2>
        {thread.replies.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.noReplies}</p>
        ) : (
          <ul className="space-y-2">
            {thread.replies.map((r) => (
              <li key={r.id}>
                <CommentItem comment={r} meId={me.id} meRole={me.role} locale={locale} />
              </li>
            ))}
          </ul>
        )}
        <ReplyForm
          threadId={thread.id}
          t={{ replyLabel: t.replyLabel, replyPlaceholder: t.replyPlaceholder, sendReply: t.sendReply }}
        />
      </section>
    </div>
  );
}

/** Load a question for inline display in a forum thread, gated by the user's plan. */
async function loadThreadQuestion(
  me: { id: string; role: "USER" | "ADMIN"; plan: "DEMO" | "PAID" },
  questionId: number,
  contentLocale: "he" | "en",
) {
  const gate = await questionAccessWhere(me);
  const question = await db.question.findFirst({
    where: { id: questionId, AND: [gate] },
    include: {
      chapter: { select: { number: true, title: true } },
      geminiAnswer: true,
    },
  });

  if (!question) {
    return { question: null, qT: null, userChoice: undefined, highlightRows: [] as Awaited<ReturnType<typeof db.sentenceHighlight.findMany>> };
  }

  const [qT, attempt, highlightRows] = await Promise.all([
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

  return { question, qT, userChoice: attempt?.chosen ?? undefined, highlightRows };
}
