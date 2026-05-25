import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { submitAttemptAction, postCommentAction, reportAnswerAction, toggleBookmarkAction } from "@/app/(user)/actions";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, ArrowRight, BarChart2, MessageSquare, Flag, Bookmark, BookmarkCheck, ClipboardList } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const HEBREW_LETTERS = ["א", "ב", "ג", "ד"];
const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireCompletedProfile();
  const { id } = await params;
  const quiz = await db.quiz.findFirst({ where: { id: Number(id), userId: me.id } });
  if (!quiz) notFound();

  const answeredIds = (
    await db.attempt.findMany({
      where: { userId: me.id, quizId: quiz.id },
      select: { questionId: true },
    })
  ).map((a) => a.questionId);

  const next = await db.question.findFirst({
    where: {
      chapterIds: { hasSome: quiz.chapterIds },
      id: { notIn: answeredIds },
      geminiAnswer: { isNot: null },
    },
    orderBy: { id: "asc" },
    include: {
      chapter: true,
      geminiAnswer: true,
      comments: { include: { user: { select: { name: true, image: true } } }, orderBy: { createdAt: "asc" } },
    },
  });

  const totalQ = await db.question.count({
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
        <h1 className="font-display text-3xl font-bold">סיימת את המבחן!</h1>
        <p className="mt-3 text-muted-foreground">
          ענית נכון על{" "}
          <span className="font-semibold text-foreground">{correct}</span>{" "}
          מתוך{" "}
          <span className="font-semibold text-foreground">{answeredIds.length}</span>{" "}
          שאלות ({accuracyPct}%).
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href={`/quiz/${id}/review`} className="gap-2">
              <ClipboardList className="h-4 w-4" />
              סקירת תשובות
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard" className="gap-2">
              <BarChart2 className="h-4 w-4" />
              לסטטיסטיקה
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/study/new">מבחן חדש</Link>
          </Button>
        </div>
      </div>
    );
  }

  const [lastAttempt, bookmark] = await Promise.all([
    db.attempt.findFirst({
      where: { userId: me.id, quizId: quiz.id },
      orderBy: { createdAt: "desc" },
    }),
    db.bookmark.findUnique({
      where: { userId_questionId: { userId: me.id, questionId: next.id } },
      select: { id: true },
    }),
  ]);
  const justAnswered = lastAttempt && lastAttempt.questionId === next.id;
  const isBookmarked = !!bookmark;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <div className="md:col-span-2 space-y-5">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{quiz.name}</span>
            <span>{answeredIds.length} / {totalQ} שאלות · {correct} נכונות</span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        {/* Chapter pill + bookmark */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            פרק {next.chapter.number}
          </Badge>
          <span className="text-xs text-muted-foreground flex-1">{next.chapter.title}</span>
          <form action={toggleBookmarkAction}>
            <input type="hidden" name="questionId" value={next.id} />
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

        {/* Question card */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <p className="font-display text-lg leading-relaxed">{next.stem}</p>

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
                    {next[`option${k}` as const]}
                  </span>
                </label>
              ))}

              <Button type="submit" className="w-full mt-1" size="lg">
                שלח תשובה
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
                  {lastAttempt.isCorrect ? "תשובה נכונה!" : "תשובה שגויה"}
                </p>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground mt-0.5">התשובה הנכונה:</span>
                  <span className="flex items-start gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white text-[11px] font-bold mt-0.5">
                      {HEBREW_LETTERS[OPTION_KEYS.indexOf(next.geminiAnswer.correctAnswer as "A" | "B" | "C" | "D")]}
                    </span>
                    <span className="text-sm font-medium leading-snug">
                      {next[`option${next.geminiAnswer.correctAnswer}` as "optionA" | "optionB" | "optionC" | "optionD"]}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Explanation body */}
            <CardContent className="pt-5 pb-6 px-6 space-y-5">
              <AnswerExplanation
                explanation={next.geminiAnswer.explanation}
                evidenceCitations={next.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null}
                whyOthersWrong={next.geminiAnswer.whyOthersWrong}
                correctAnswer={next.geminiAnswer.correctAnswer}
                options={[
                  { key: "A", text: next.optionA },
                  { key: "B", text: next.optionB },
                  { key: "C", text: next.optionC },
                  { key: "D", text: next.optionD },
                ]}
                insufficientEvidence={next.geminiAnswer.insufficientEvidence}
              />

              <Separator className="opacity-50" />

              {/* Report section */}
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors list-none">
                  <Flag className="h-3.5 w-3.5" />
                  לדווח שהתשובה שגויה
                </summary>
                <form action={reportAnswerAction} className="mt-3 space-y-2">
                  <input type="hidden" name="questionId" value={next.id} />
                  <Textarea
                    name="explanation"
                    required
                    minLength={10}
                    rows={2}
                    placeholder="הסבר/י מדוע התשובה שגויה"
                    className="text-sm"
                  />
                  <Button variant="outline" size="sm" type="submit" className="gap-2">
                    <Flag className="h-3.5 w-3.5" />
                    שלח דיווח
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
          הערות לשאלה
        </h2>

        {next.comments.length === 0 ? (
          <p className="text-xs text-muted-foreground">אין הערות עדיין.</p>
        ) : (
          <ul className="space-y-2">
            {next.comments.map((c) => (
              <li key={c.id}>
                <Card>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      {c.user.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.user.image} alt="" className="h-5 w-5 rounded-full object-cover" />
                      ) : null}
                      <span className="text-xs font-medium">{c.user.name}</span>
                      <span className="text-xs text-muted-foreground ms-auto">
                        {c.createdAt.toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap leading-snug">{c.body}</p>
                  </CardContent>
                </Card>
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
            placeholder="הוסיפו הערה לשאלה זו"
            className="text-sm"
          />
          <Button variant="secondary" size="sm" type="submit" className="w-full gap-2">
            <ArrowRight className="h-3.5 w-3.5" />
            פרסם הערה
          </Button>
        </form>
      </aside>
    </div>
  );
}
