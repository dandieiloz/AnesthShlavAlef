import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { toggleBookmarkAction } from "@/app/(user)/actions";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
} from "lucide-react";

const HEBREW_LETTERS = ["א", "ב", "ג", "ד"];
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

  const questions = await db.question.findMany({
    where: { id: { in: [...attemptMap.keys()] } },
    include: {
      chapter: { select: { number: true, title: true } },
      geminiAnswer: true,
    },
    orderBy: { id: "asc" },
  });

  if (questions.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        המבחן טרם הושלם.{" "}
        <Link href={`/quiz/${id}`} className="text-primary hover:underline">
          חזרה למבחן
        </Link>
      </div>
    );
  }

  const total = questions.length;
  const correct = [...attemptMap.values()].filter((a) => a.isCorrect).length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const wrongCount = total - correct;

  const filtered = showWrongOnly
    ? questions.filter((q) => !attemptMap.get(q.id)?.isCorrect)
    : questions;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
            <Link href="/quizzes" className="hover:text-foreground transition-colors">
              המבחנים שלי
            </Link>
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="text-foreground font-medium truncate max-w-[180px] sm:max-w-none">
              {quiz.name}
            </span>
          </div>
          <h1 className="font-display text-2xl font-bold">סקירת תשובות</h1>
          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1 text-success font-medium">
              <CheckCircle2 className="h-4 w-4" />
              {correct} נכונות
            </span>
            <span className="flex items-center gap-1 text-destructive font-medium">
              <XCircle className="h-4 w-4" />
              {wrongCount} שגויות
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
              {accuracy}% דיוק
            </span>
          </div>
        </div>

        {/* Filter toggle */}
        <div className="flex items-center gap-2 self-start">
          {showWrongOnly ? (
            <Button asChild variant="ghost" size="sm" className="text-xs">
              <Link href={`/quiz/${id}/review`}>הצג הכל ({total})</Link>
            </Button>
          ) : null}
          <Button
            asChild
            variant={showWrongOnly ? "default" : "outline"}
            size="sm"
            className="text-xs"
          >
            <Link href={`/quiz/${id}/review${showWrongOnly ? "" : "?wrong=1"}`}>
              {showWrongOnly ? "מסנן: שגיאות בלבד" : `שגיאות בלבד (${wrongCount})`}
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
            🎉 ענית נכון על כל השאלות!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((q, i) => {
            const attempt = attemptMap.get(q.id)!;
            const isBookmarked = bookmarkedIds.has(q.id);
            const displayIndex = showWrongOnly ? questions.indexOf(q) + 1 : i + 1;
            const optionTexts = [q.optionA, q.optionB, q.optionC, q.optionD];

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
                        שאלה {displayIndex}
                      </span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        פרק {q.chapter.number}
                      </Badge>
                      <span className="text-xs text-muted-foreground hidden sm:block truncate">
                        {q.chapter.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {attempt.isCorrect ? (
                        <span className="flex items-center gap-1 text-xs font-semibold text-success">
                          <CheckCircle2 className="h-4 w-4" />
                          נכון
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                          <XCircle className="h-4 w-4" />
                          שגוי
                        </span>
                      )}
                      <form action={toggleBookmarkAction}>
                        <input type="hidden" name="questionId" value={q.id} />
                        <button
                          type="submit"
                          title={isBookmarked ? "הסר סימנייה" : "הוסף סימנייה"}
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
                          {isBookmarked ? "מסומן" : "סמן"}
                        </button>
                      </form>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="px-5 pb-5 space-y-4">
                  {/* Question stem */}
                  <p className="font-display text-base leading-relaxed">{q.stem}</p>

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
                          <span className={letterClass}>{HEBREW_LETTERS[idx]}</span>
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
                          הסבר מפורט
                          <span className="ms-auto text-muted-foreground font-normal group-open:hidden">
                            ▼ פתח
                          </span>
                          <span className="ms-auto text-muted-foreground font-normal hidden group-open:block">
                            ▲ סגור
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
                          />
                        </div>
                      </details>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bottom nav */}
      <div className="flex items-center justify-between gap-3 pt-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/quizzes" className="gap-2">
            <ArrowRight className="h-3.5 w-3.5" />
            כל המבחנים
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/study/new">מבחן חדש</Link>
        </Button>
      </div>
    </div>
  );
}
