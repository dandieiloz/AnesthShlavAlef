import { requireCompletedProfile } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BarChart2, CheckCircle2, ClipboardList } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import { getLocale, getContentLocale } from "@/lib/locale";
import { loadQuizSession } from "./quiz-session";
import { QuizRunner } from "./QuizRunner";

export default async function QuizPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireCompletedProfile();
  const { id } = await params;
  const quizId = Number(id);
  if (!Number.isFinite(quizId)) notFound();

  const [uiLocale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const session = await loadQuizSession({ user: me, quizId, contentLocale });
  if (!session) notFound();

  const dict = getDictionary(uiLocale);
  const t = dict.quiz;

  if (session.questions.length === 0) {
    const { answered, correct } = session.totals;
    const accuracyPct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    return (
      <div className="mx-auto max-w-lg animate-fade-in py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h1 className="font-display text-3xl font-bold">{t.finishedTitle}</h1>
        <p className="mt-3 text-muted-foreground">
          {t.finishedSummary(correct, answered, accuracyPct)}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href={`/quiz/${quizId}/review`} className="gap-2">
              <ClipboardList className="h-4 w-4" />
              {t.reviewAnswers}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/study" className="gap-2">
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

  return (
    <QuizRunner
      quizId={session.quiz.id}
      quizName={session.quiz.name}
      contentLocale={contentLocale}
      totalQ={session.totals.totalQ}
      initialAnswered={session.totals.answered}
      initialCorrect={session.totals.correct}
      initialBatch={session.questions}
      initialHasMore={session.hasMore}
      initialPast={session.answeredHistory}
      uiLocale={uiLocale}
    />
  );
}
