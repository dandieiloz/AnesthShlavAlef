import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getQuizProgressMany } from "@/lib/quiz-progress";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { StatsSection } from "./StatsSection";
import { QuizzesClient, type QuizRow } from "@/app/quizzes/QuizzesClient";
import {
  PlusCircle,
  ListChecks,
  Bug,
} from "lucide-react";

function residencyLabel(year: number | null, t: { yearLabels: Record<number, string>; yearLabel: (n: number) => string }): string {
  if (!year) return "";
  return t.yearLabels[year] ?? t.yearLabel(year);
}

export default async function StudyPage() {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const t = getDictionary(locale).study;

  const [allQuizzes, dbUser] = await Promise.all([
    db.quiz.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUnique({
      where: { id: me.id },
      select: { residencyYear: true },
    }),
  ]);

  const progressMap = await getQuizProgressMany(allQuizzes);

  const quizRows: QuizRow[] = allQuizzes.map((q) => {
    const p = progressMap.get(q.id)!;
    return {
      id: q.id,
      name: q.name,
      chapterCount: q.chapterIds.length,
      createdAt: q.createdAt.toISOString(),
      answered: p.answered,
      total: p.total,
      correct: p.correct,
      isComplete: p.isComplete,
      accuracyPct: p.accuracyPct,
      lastActivityAt: p.lastActivityAt?.toISOString() ?? null,
    };
  });
  const tQuizzes = getDictionary(locale).quizzes;

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {me.name ? t.greeting(me.name.split(" ")[0]) : t.greetingAnon}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
        </div>
        {dbUser?.residencyYear && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {residencyLabel(dbUser.residencyYear, t)}
          </Badge>
        )}
      </div>

      {/* Stats + My quizzes */}
      <section>
        <StatsSection userId={me.id} locale={locale}>
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold flex items-center gap-2">
                  <ListChecks className="h-4 w-4 text-primary" />
                  {tQuizzes.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {quizRows.length === 0 ? tQuizzes.empty : tQuizzes.countSuffix(quizRows.length)}
                </p>
              </div>
              <Button asChild size="sm" className="gap-1.5">
                <Link href="/study/new">
                  <PlusCircle className="h-3.5 w-3.5" />
                  {tQuizzes.newQuiz}
                </Link>
              </Button>
            </div>
            {quizRows.length > 0 && (
              <QuizzesClient quizzes={quizRows} locale={locale} />
            )}
          </div>
        </StatsSection>
      </section>

      {/* Report an issue */}
      <section>
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bug className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{t.reportIssueTitle}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.reportIssueHint}</p>
              </div>
            </div>
            <Button asChild size="sm" variant="secondary">
              <Link href="/study/report">{t.reportIssueCta}</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

