import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { ReportAnswerForm } from "@/components/ReportAnswerForm";
import { toggleBookmarkAction, postCommentAction } from "@/app/(user)/actions";
import { CommentItem } from "@/components/CommentItem";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowRight,
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
} from "lucide-react";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere } from "@/lib/plan";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default async function QuizReviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ wrong?: string }>;
}) {
  const me = await requireCompletedProfile();
  const { id } = await params;
  const { wrong } = await searchParams;
  const showWrongOnly = wrong === "1";

  const [uiLocale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const dict = getDictionary(uiLocale);
  const t = dict.review;
  const LETTERS = t.labels[contentLocale] ?? ["A", "B", "C", "D"];

  const quiz = await db.quiz.findFirst({ where: { id: Number(id), userId: me.id } });
  if (!quiz) notFound();

  const [attemptsRaw, bookmarkRows] = await Promise.all([
    db.attempt.findMany({
      where: { quizId: quiz.id, userId: me.id },
      orderBy: { createdAt: "desc" },
    }),
    db.bookmark.findMany({
      where: { userId: me.id },
      select: { questionId: true },
    }),
  ]);

  // Latest attempt per question (descending order means first = latest)
  const attemptMap = new Map<number, (typeof attemptsRaw)[0]>();
  for (const a of attemptsRaw) {
    if (!attemptMap.has(a.questionId)) attemptMap.set(a.questionId, a);
  }

  const bookmarkedIds = new Set(bookmarkRows.map((b) => b.questionId));

  const planGate = await questionAccessWhere(me);
  const questions = await db.question.findMany({
    where: { id: { in: [...attemptMap.keys()] }, AND: [planGate] },
    include: {
      chapter: { select: { number: true, title: true } },
      geminiAnswer: true,
      comments: {
        include: { user: { select: { name: true, image: true, hospitalName: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { id: "asc" },
  });

  const highlightRows = await db.sentenceHighlight.findMany({
    where: {
      userId: me.id,
      locale: contentLocale,
      questionId: { in: [...attemptMap.keys()] },
    },
    select: { id: true, questionId: true, section: true, sentenceIndex: true, colorId: true, sentenceHash: true, note: true },
  });
  const highlightsByQ = new Map<number, typeof highlightRows>();
  for (const h of highlightRows) {
    const arr = highlightsByQ.get(h.questionId) ?? [];
    arr.push(h);
    highlightsByQ.set(h.questionId, arr);
  }

  if (questions.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        {t.notCompleted}{" "}
        <Link href={`/quiz/${id}`} className="text-primary hover:underline">
          {t.backToQuiz}
        </Link>
      </div>
    );
  }

  // Translate question content for non-Hebrew locales
  const questionTranslations = await Promise.all(
    questions.map((q) =>
      getTranslatedFields(
        "Question",
        String(q.id),
        {
          stem: q.stem,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          chapterTitle: q.chapter.title,
        },
        contentLocale
      )
    )
  );
  const tQuestion = new Map(questions.map((q, i) => [q.id, questionTranslations[i]]));

  const total = questions.length;
  const correct = [...attemptMap.values()].filter((a) => a.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const wrongCount = total - correct;

  const filtered = showWrongOnly
    ? questions.filter((q) => !attemptMap.get(q.id)?.isCorrect)
    : questions;

  const ChevronIcon = uiLocale === "he" ? ChevronLeft : ChevronRight;
  const ArrowIcon = uiLocale === "he" ? ArrowRight : ArrowLeft;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <Link href="/study" className="hover:text-foreground transition-colors">
              {t.myQuizzes}
            </Link>
            <ChevronIcon className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium truncate max-w-[180px] sm:max-w-none">
              {quiz.name}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold">{t.title}</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-success font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {t.correct(correct)}
            </span>
            <span className="flex items-center gap-1 text-destructive font-medium">
              <XCircle className="h-4 w-4" />
              {t.wrong(wrongCount)}
            </span>
            <span>·</span>
            <span
              className={`font-semibold ${
                accuracy >= 70
                  ? "text-success"
                  : accuracy >= 50
                  ? "text-amber-500"
                  : "text-destructive"
              }`}
            >
              {t.accuracyPct(accuracy)}
            </span>
          </div>
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-2 self-start">
          {showWrongOnly ? (
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href={`/quiz/${id}/review`}>{t.showAll(total)}</Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant={showWrongOnly ? "default" : "outline"}
            size="sm"
            className="text-xs"
          >
            <Link href={`/quiz/${id}/review${showWrongOnly ? "" : "?wrong=1"}`}>
              {showWrongOnly ? t.filterWrongOnly : t.wrongOnlyToggle(wrongCount)}
            </Link>
          </Button>
        </div>
      </div>

      {/* Progress bar summary */}
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-success transition-all"
          style={{ width: `${accuracy}%` }}
        />
      </div>

      {/* Question list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            {t.allCorrect}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((q, i) => {
            const attempt = attemptMap.get(q.id)!;
            const isBookmarked = bookmarkedIds.has(q.id);
            const displayIndex = showWrongOnly ? questions.indexOf(q) + 1 : i + 1;
            const qT = tQuestion.get(q.id)!;
            const optionTexts = [qT.optionA, qT.optionB, qT.optionC, qT.optionD];

            return (
              <Card
                key={q.id}
                className={`overflow-hidden border-2 ${
                  attempt.isCorrect ? "border-success/25" : "border-destructive/30"
                }`}
              >
                {/* Card header */}
                <CardHeader className="py-3 px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-muted-foreground shrink-0">
                        {t.questionN(displayIndex)}
                      </span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {t.chapterPrefix(q.chapter.number)}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:block truncate">
                        {qT.chapterTitle}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {attempt.isCorrect ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          {t.correctBadge}
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                          <XCircle className="h-4 w-4" />
                          {t.wrongBadge}
                        </span>
                      )}
                      <form action={toggleBookmarkAction}>
                        <input type="hidden" name="questionId" value={q.id} />
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
                  </div>
                </CardHeader>

                <CardContent className="px-5 pb-5 space-y-4">
                  {/* Question stem */}
                  <p className="font-display text-base leading-relaxed">{qT.stem}</p>

                  {/* Answer options */}
                  <div className="space-y-2">
                    {OPTION_KEYS.map((k, idx) => {
                      const optionText = optionTexts[idx];
                      const isChosen = attempt.chosen === k;
                      const isCorrectAnswer = q.geminiAnswer?.correctAnswer === k;

                      let rowClass =
                        "flex items-start gap-2.5 rounded-lg border p-3 text-sm transition-colors ";
                      let letterClass =
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5 ";

                      if (isCorrectAnswer) {
                        rowClass += "border-success/50 bg-success/10";
                        letterClass += "bg-success text-white";
                      } else if (isChosen && !attempt.isCorrect) {
                        rowClass += "border-destructive/50 bg-destructive/10 text-destructive";
                        letterClass += "bg-destructive text-white";
                      } else {
                        rowClass += "border-border bg-background text-muted-foreground";
                        letterClass += "bg-muted text-muted-foreground";
                      }

                      return (
                        <div key={k} className={rowClass}>
                          <span className={letterClass}>{LETTERS[idx]}</span>
                          <span className="flex-1 leading-snug">{optionText}</span>
                          {isCorrectAnswer && (
                            <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                          )}
                          {isChosen && !attempt.isCorrect && (
                            <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {q.geminiAnswer && (
                    <>
                      <Separator className="opacity-40" />
                      <details open={!attempt.isCorrect} className="group">
                        <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80">
                          <BookOpen className="h-3.5 w-3.5 shrink-0" />
                          {t.detailedExplanation}
                          <span className="ms-auto text-muted-foreground font-normal group-open:hidden">
                            {t.openDetails}
                          </span>
                          <span className="ms-auto text-muted-foreground font-normal hidden group-open:block">
                            {t.closeDetails}
                          </span>
                        </summary>
                        <div className="mt-3">
                          <AnswerExplanation
                            explanation={q.geminiAnswer.explanation}
                            evidenceCitations={q.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null}
                            whyOthersWrong={q.geminiAnswer.whyOthersWrong}
                            correctAnswer={q.geminiAnswer.correctAnswer}
                            options={[
                              { key: "A", text: q.optionA },
                              { key: "B", text: q.optionB },
                              { key: "C", text: q.optionC },
                              { key: "D", text: q.optionD },
                            ]}
                            insufficientEvidence={q.geminiAnswer.insufficientEvidence}
                            locale={contentLocale}
                            questionId={q.id}
                            highlights={highlightsByQ.get(q.id) ?? []}
                            highlightT={dict.highlights}
                          />
                        </div>
                      </details>
                      <ReportAnswerForm
                        questionId={q.id}
                        labels={{
                          reportButton: t.reportButton,
                          reportHint: t.reportHint,
                          reportFieldLabel: t.reportFieldLabel,
                          reportPlaceholder: t.reportPlaceholder,
                          reportMinHint: t.reportMinHint,
                          sendReport: t.sendReport,
                        }}
                      />
                    </>
                  )}

                  {/* Comments / discussion */}
                  <Separator className="opacity-40" />
                  <details className="group">
                    <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
                      <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                      {dict.quiz.comments}
                      {q.comments.length > 0 && (
                        <span className="ms-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                          {q.comments.length}
                        </span>
                      )}
                    </summary>
                    <div className="mt-3 space-y-3">
                      {q.comments.length === 0 ? (
                        <p className="text-xs text-muted-foreground">{dict.quiz.noComments}</p>
                      ) : (
                        <ul className="space-y-2">
                          {q.comments.map((c) => (
                            <li key={c.id}>
                              <CommentItem comment={c} meId={me.id} meRole={me.role} locale={uiLocale} />
                            </li>
                          ))}
                        </ul>
                      )}
                      <form action={postCommentAction} className="space-y-2">
                        <input type="hidden" name="questionId" value={q.id} />
                        <Textarea
                          name="body"
                          required
                          rows={2}
                          placeholder={dict.quiz.writeComment}
                          className="text-sm"
                        />
                        <Button variant="secondary" size="sm" type="submit" className="gap-2">
                          <ArrowRight className="h-3.5 w-3.5" />
                          {dict.quiz.postComment}
                        </Button>
                      </form>
                    </div>
                  </details>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/study" className="gap-2">
            <ArrowIcon className="h-3.5 w-3.5" />
            {t.allQuizzes}
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/study/new">{t.newQuiz}</Link>
        </Button>
      </div>
    </div>
  );
}
