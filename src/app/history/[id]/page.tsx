import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { ReportAnswerForm } from "@/components/ReportAnswerForm";
import { QuestionImage } from "@/components/QuestionImage";
import { QuestionVideo } from "@/components/QuestionVideo";
import { CommentItem } from "@/components/CommentItem";
import { SubmitButton } from "@/components/SubmitButton";
import { postCommentAction } from "@/app/(user)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, BookOpen, CheckCircle2, MessageSquare } from "lucide-react";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";
import { assertCanAccessQuestion } from "@/lib/plan";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;
const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

export default async function HistoryQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireCompletedProfile();
  const { id } = await params;
  const questionId = Number(id);
  if (!Number.isFinite(questionId)) notFound();

  // The user must have at least one attempt for this question; otherwise this page is hidden.
  // Admins can view any question to support troubleshooting and content review.
  const userAttemptCount = await db.attempt.count({
    where: { userId: me.id, questionId },
  });
  if (userAttemptCount === 0 && me.role !== "ADMIN") notFound();

  await assertCanAccessQuestion(me, questionId);

  const [uiLocale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const dict = getDictionary(uiLocale);
  const t = dict.review;
  const letters = t.labels[contentLocale] ?? ["A", "B", "C", "D"];

  const [question, attempts, highlightRows, latestUserReport, comments] = await Promise.all([
    db.question.findUnique({
      where: { id: questionId },
      include: {
        chapter: { select: { number: true, title: true } },
        geminiAnswer: true,
      },
    }),
    db.attempt.findMany({
      where: { userId: me.id, questionId },
      orderBy: { createdAt: "desc" },
      select: { id: true, chosen: true, isCorrect: true, createdAt: true, quizId: true },
    }),
    db.sentenceHighlight.findMany({
      where: { userId: me.id, locale: contentLocale, questionId },
      select: { id: true, questionId: true, section: true, sentenceIndex: true, colorId: true, sentenceHash: true, note: true },
    }),
    db.answerReport.findFirst({
      where: { questionId, userId: me.id },
      orderBy: { createdAt: "desc" },
      select: { status: true, adminResponse: true },
    }),
    db.comment.findMany({
      where: { questionId },
      include: { user: { select: { name: true, image: true, hospitalName: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  if (!question) notFound();

  const qT = await getTranslatedFields(
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
  );
  const optionTexts = [qT.optionA, qT.optionB, qT.optionC, qT.optionD];
  const correctAnswer = question.geminiAnswer?.correctAnswer ?? question.correctAnswer;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Link
        href="/history"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        חזרה לשאלות שראיתי
      </Link>

      <Card>
        <CardContent className="p-4 space-y-3" dir={contentLocale === "he" ? "rtl" : "ltr"}>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs shrink-0">
              {dict.common.chapter} {question.chapter.number}
            </Badge>
            <span className="text-xs text-muted-foreground line-clamp-1">
              {qT.chapterTitle}
            </span>
            {question.source && (
              <span className="text-xs text-muted-foreground">· {question.source}</span>
            )}
          </div>

          <p dir="auto" className="text-base font-medium leading-relaxed [unicode-bidi:plaintext]">
            {qT.stem}
          </p>

          <QuestionImage url={question.imageUrl} alt={question.imageAlt} />
          <QuestionVideo url={question.videoUrl} />

          <div className="space-y-1.5">
            {OPTION_KEYS.map((k, idx) => {
              const isCorrect = correctAnswer === k;
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

          {question.geminiAnswer ? (
            <>
              <Separator className="opacity-40" />
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <BookOpen className="h-3.5 w-3.5 shrink-0" />
                {t.detailedExplanation}
              </div>
              <AnswerExplanation
                explanation={question.geminiAnswer.explanation}
                evidenceCitations={question.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null}
                whyOthersWrong={question.geminiAnswer.whyOthersWrong}
                correctAnswer={question.geminiAnswer.correctAnswer}
                options={[
                  { key: "A", text: question.optionA },
                  { key: "B", text: question.optionB },
                  { key: "C", text: question.optionC },
                  { key: "D", text: question.optionD },
                ]}
                insufficientEvidence={question.geminiAnswer.insufficientEvidence}
                locale={contentLocale}
                questionId={question.id}
                highlights={highlightRows}
                highlightT={dict.highlights}
              />
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              עדיין אין הסבר זמין לשאלה זו.
            </p>
          )}

          {question.geminiAnswer && (
            <ReportAnswerForm
              questionId={question.id}
              latestReport={latestUserReport ? { status: latestUserReport.status, adminResponse: latestUserReport.adminResponse } : null}
              labels={{
                reportButton: t.reportButton,
                reportHint: t.reportHint,
                reportFieldLabel: t.reportFieldLabel,
                reportPlaceholder: t.reportPlaceholder,
                reportMinHint: t.reportMinHint,
                sendReport: t.sendReport,
                reportThanks: t.reportThanks,
                pendingReport: t.pendingReport,
                reportRespondedBadge: t.reportRespondedBadge,
                reportClosedBadge: t.reportClosedBadge,
                reportResponseHeader: t.reportResponseHeader,
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 shrink-0" />
            {dict.quiz.comments}
            {comments.length > 0 && (
              <span className="ms-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                {comments.length}
              </span>
            )}
          </h2>
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">{dict.quiz.noComments}</p>
          ) : (
            <ul className="space-y-2">
              {comments.map((c) => (
                <li key={c.id}>
                  <CommentItem comment={c} meId={me.id} meRole={me.role} locale={uiLocale} />
                </li>
              ))}
            </ul>
          )}
          <form action={postCommentAction} className="space-y-2 pt-2">
            <input type="hidden" name="questionId" value={question.id} />
            <Textarea
              name="body"
              required
              rows={2}
              placeholder={dict.quiz.writeComment}
              className="text-sm"
            />
            <SubmitButton variant="secondary" size="sm" className="gap-2">
              <ArrowRight className="h-3.5 w-3.5" />
              {dict.quiz.postComment}
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-sm font-semibold">הניסיונות שלי ({attempts.length})</h2>
          {attempts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">עדיין לא ניסית שאלה זו.</p>
          ) : (
          <ul className="divide-y">
            {attempts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  {DATE_FORMATTER.format(a.createdAt)}
                </span>
                <span className="font-mono text-xs">בחרת: {a.chosen}</span>
                {a.isCorrect ? (
                  <span className="text-xs rounded px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                    ✓ נכון
                  </span>
                ) : (
                  <span className="text-xs rounded px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300">
                    ✗ שגוי
                  </span>
                )}
                {a.quizId !== null ? (
                  <Link
                    href={`/quiz/${a.quizId}/review`}
                    className="text-xs text-primary hover:underline"
                  >
                    מבחן #{a.quizId}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </li>
            ))}
          </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
