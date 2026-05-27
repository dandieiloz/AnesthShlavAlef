import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { getQuizProgressMany } from "@/lib/quiz-progress";
import { QuizzesClient } from "./QuizzesClient";
import type { QuizRow } from "./QuizzesClient";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";

export default async function QuizzesPage() {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const t = getDictionary(locale).quizzes;

  const quizzes = await db.quiz.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
  });

  const progressMap = await getQuizProgressMany(quizzes);

  const rows: QuizRow[] = quizzes.map((q) => {
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

  return (
    <div className="space-y-6 animate-fade-in" dir={locale === "he" ? "rtl" : "ltr"}>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quizzes.length === 0 ? t.empty : t.countSuffix(quizzes.length)}
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/study/new">
            <PlusCircle className="h-3.5 w-3.5" />
            {t.newQuiz}
          </Link>
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground text-sm">{t.emptyShort}</p>
          <Button asChild>
            <Link href="/study/new">
              <PlusCircle className="h-4 w-4 me-1.5" />
              {t.createFirst}
            </Link>
          </Button>
        </div>
      ) : (
        <QuizzesClient quizzes={rows} locale={locale} t={t} />
      )}
    </div>
  );
}
