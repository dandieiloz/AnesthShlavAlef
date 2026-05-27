import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { submitAttemptAction, postCommentAction, reportAnswerAction, toggleBookmarkAction } from "@/app/(user)/actions";
import { CommentItem } from "@/components/CommentItem";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, ArrowRight, BarChart2, MessageSquare, Flag, Bookmark, BookmarkCheck, ClipboardList } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getTranslatedFields } from "@/lib/translate";
import { getDictionary } from "@/lib/i18n";
import { PrefetchNextTranslation } from "./PrefetchNextTranslation";

const HEBREW_LETTERS = ["א", "ב", "ג", "ד"];
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireCompletedProfile();
  const { id } = await params;
  const quiz = await db.quiz.findFirst({ where: { id: Number(id), userId: me.id } });
  if (!quiz) notFound();

  const [uiLocale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const t = getDictionary(uiLocale).quiz;

  const answeredIds = (
    await db.attempt.findMany({
      where: { userId: me.id, quizId: quiz.id },
      select: { questionId: true },
    })
  ).map((a) => a.questionId);

  // New quizzes have a fixed questionIds set; old quizzes fall back to chapterIds.
  const useFixedSet = quiz.questionIds.length > 0;
  const questionFilter = useFixedSet
    ? { id: { in: quiz.questionIds, notIn: answeredIds }, geminiAnswer: { isNot: null } }
    : { chapterIds: { hasSome: quiz.chapterIds }, id: { notIn: answeredIds }, geminiAnswer: { isNot: null } };

  const next = await db.question.findFirst({
    where: questionFilter,
    orderBy: { id: "asc" },
    include: {
      chapter: true,
      geminiAnswer: true,
      comments: { include: { user: { select: { name: true, image: true, hospitalName: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  // Look one question ahead so we can warm the translation cache in the
  // background while the user reads the current one. Only the id is needed.
  const lookahead = next
    ? await db.question.findFirst({
        where: useFixedSet
          ? {
              id: { in: quiz.questionIds, notIn: [...answeredIds, next.id] },
              geminiAnswer: { isNot: null },
            }
          : {
              chapterIds: { hasSome: quiz.chapterIds },
              id: { notIn: [...answeredIds, next.id] },
              geminiAnswer: { isNot: null },
            },
        orderBy: { id: "asc" },
        select: { id: true },
      })
    : null;

  const totalQ = useFixedSet
    ? quiz.questionIds.length
    : await db.question.count({
        where: { chapterIds: { hasSome: quiz.chapterIds }, geminiAnswer: { isNot: null } },
      });
  const correct = await db.attempt.count({ where: { quizId: quiz.id, userId: me.id, isCorrect: true } });
  const progressPct = totalQ > 0 ? Math.round((answeredIds.length / totalQ) * 100) : 0;

  if (!next) {
    const accuracyPct = answeredIds.length > 0 ? Math.round((correct / answeredIds.length) * 100) : 0;
    return (
      <div className="mx-auto max-w-lg animate-fade-in py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h1 className="font-display text-3xl font-bold">{t.finishedTitle}</h1>
        <p className="mt-3 text-muted-foreground">
          {t.finishedSummary(correct, answeredIds.length, accuracyPct)}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href={`/quiz/${id}/review`} className="gap-2">
              <ClipboardList className="h-4 w-4" />
              {t.reviewAnswers}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard" className="gap-2">
              <BarChart2 className="h-4 w-4" />
              {t.backToStats}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/study/new">{t.newQuiz}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const [lastAttempt, bookmark, highlights] = await Promise.all([
    db.attempt.findFirst({
      where: { userId: me.id, quizId: quiz.id },
      orderBy: { createdAt: "desc" },
    }),
    db.bookmark.findUnique({
      where: { userId_questionId: { userId: me.id, questionId: next.id } },
      select: { id: true },
    }),
    db.sentenceHighlight.findMany({
      where: { userId: me.id, questionId: next.id, locale: contentLocale },
      select: { id: true, section: true, sentenceIndex: true, colorId: true, sentenceHash: true, note: true },
    }),
  ]);
  const justAnswered = lastAttempt && lastAttempt.questionId === next.id;
  const isBookmarked = !!bookmark;

  // ── Translation ───────────────────────────────────────────────────────────────
  const qId = String(next.id);

  const [qFields, ansFields] = await Promise.all([
    getTranslatedFields(
      "Question",
      qId,
      { stem: next.stem, optionA: next.optionA, optionB: next.optionB, optionC: next.optionC, optionD: next.optionD },
      contentLocale,
    ),
    next.geminiAnswer
      ? getTranslatedFields(
          "GeminiAnswer",
          String(next.geminiAnswer.id),
          { explanation: next.geminiAnswer.explanation, whyOthersWrong: next.geminiAnswer.whyOthersWrong },
          contentLocale,
        )
      : Promise.resolve({ explanation: "", whyOthersWrong: "" }),
  ]);

  // Merge translated text back — Hebrew remains the source of truth, we just shadow for rendering
  const display = {
    stem: qFields.stem,
    optionA: qFields.optionA,
    optionB: qFields.optionB,
    optionC: qFields.optionC,
    optionD: qFields.optionD,
    explanation: ansFields.explanation || next.geminiAnswer?.explanation || "",
    whyOthersWrong: ansFields.whyOthersWrong || next.geminiAnswer?.whyOthersWrong || "",
  };
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Background-warm the next question's translation cache so the next page
          render is instant. Renders nothing; only runs when contentLocale !== "he". */}
      {contentLocale !== "he" && lookahead && (
        <PrefetchNextTranslation questionId={lookahead.id} />
      )}
      <div className="md:col-span-2 space-y-5">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{quiz.name}</span>
            <span>{t.progress(answeredIds.length, totalQ, correct)}</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        {/* Chapter pill + bookmark */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {getDictionary(uiLocale).common.chapter} {next.chapter.number}
          </Badge>
          <span className="text-xs text-muted-foreground flex-1">{next.chapter.title}</span>
          <form action={toggleBookmarkAction}>
            <input type="hidden" name="questionId" value={next.id} />
            <button
              type="submit"
              title={isBookmarked ? t.removeBookmark : t.addBookmark}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                isBookmarked
                  ? "text-amber-500 hover:text-amber-600"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isBookmarked ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
              {isBookmarked ? t.bookmarked : t.bookmark}
            </button>
          </form>
        </div>

        {/* Question card */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <p className="font-display text-lg leading-relaxed">{display.stem}</p>
            {next.source && (
              <p className="text-xs text-muted-foreground">{t.source}: {next.source}</p>
            )}

            <form action={submitAttemptAction} className="space-y-3">
              <input type="hidden" name="quizId" value={quiz.id} />
              <input type="hidden" name="questionId" value={next.id} />

              {OPTION_KEYS.map((k, i) => (
                <label
                  key={k}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3.5 text-sm transition-colors hover:border-primary/40 hover:bg-primary/5 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                >
                  <input type="radio" name="chosen" value={k} required className="sr-only" />
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-bold">
                    {HEBREW_LETTERS[i]}
                  </span>
                  <span className="flex-1 leading-snug pt-0.5">
                    {display[`option${k}` as "optionA" | "optionB" | "optionC" | "optionD"]}
                  </span>
                </label>
              ))}

              <Button type="submit" className="w-full mt-1" size="lg">
                {t.submitAnswer}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Reveal / explanation */}
        {justAnswered && next.geminiAnswer && (
          <Card
            className={`border-2 animate-fade-in overflow-hidden ${
              lastAttempt.isCorrect
                ? "border-success/40"
                : "border-destructive/40"
            }`}
          >
            {/* Verdict banner */}
            <div
              className={`px-5 py-4 flex items-start gap-3 ${
                lastAttempt.isCorrect
                  ? "bg-success/10"
                  : "bg-destructive/10"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {lastAttempt.isCorrect ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <p className={`font-display text-lg font-bold leading-tight ${lastAttempt.isCorrect ? "text-success" : "text-destructive"}`}>
                  {lastAttempt.isCorrect ? t.correct : t.incorrect}
                </p>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground mt-0.5">{t.correctAnswerLabel}</span>
                  <span className="flex items-start gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white text-[11px] font-bold mt-0.5">
                      {HEBREW_LETTERS[OPTION_KEYS.indexOf(next.geminiAnswer.correctAnswer as "A" | "B" | "C" | "D")]}
                    </span>
                    <span className="text-sm font-medium leading-snug">
                      {display[`option${next.geminiAnswer.correctAnswer}` as "optionA" | "optionB" | "optionC" | "optionD"]}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Explanation body */}
            <CardContent className="pt-5 pb-6 px-6 space-y-5">
              <AnswerExplanation
                explanation={display.explanation}
                evidenceCitations={next.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null}
                whyOthersWrong={display.whyOthersWrong}
                correctAnswer={next.geminiAnswer.correctAnswer}
                options={[
                  { key: "A", text: display.optionA },
                  { key: "B", text: display.optionB },
                  { key: "C", text: display.optionC },
                  { key: "D", text: display.optionD },
                ]}
                insufficientEvidence={next.geminiAnswer.insufficientEvidence}
                locale={contentLocale}
                questionId={next.id}
                highlights={highlights}
                highlightT={getDictionary(uiLocale).highlights}
              />

              <Separator className="opacity-50" />

              {/* Report section */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors list-none">
                  <Flag className="h-3.5 w-3.5" />
                  {t.reportButton}
                </summary>
                <form action={reportAnswerAction} className="mt-3 space-y-2">
                  <input type="hidden" name="questionId" value={next.id} />
                  <Textarea
                    name="explanation"
                    required
                    minLength={10}
                    rows={2}
                    placeholder={t.reportPlaceholder}
                    className="text-sm"
                  />
                  <Button variant="outline" size="sm" type="submit" className="gap-2">
                    <Flag className="h-3.5 w-3.5" />
                    {t.sendReport}
                  </Button>
                </form>
              </details>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Comments sidebar */}
      <aside className="space-y-3">
        <h2 className="font-display text-base font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          {t.comments}
        </h2>

        {next.comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t.noComments}</p>
        ) : (
          <ul className="space-y-2">
            {next.comments.map((c) => (
              <li key={c.id}>
                <CommentItem comment={c} meId={me.id} meRole={me.role} locale={uiLocale} />
              </li>
            ))}
          </ul>
        )}

        <form action={postCommentAction} className="space-y-2">
          <input type="hidden" name="questionId" value={next.id} />
          <Textarea
            name="body"
            required
            rows={2}
            placeholder={t.writeComment}
            className="text-sm"
          />
          <Button variant="secondary" size="sm" type="submit" className="w-full gap-2">
            <ArrowRight className="h-3.5 w-3.5" />
            {t.postComment}
          </Button>
        </form>
      </aside>
    </div>
  );
}
