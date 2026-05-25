import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { getQuizProgressMany } from "@/lib/quiz-progress";
import { QuizzesClient } from "./QuizzesClient";
import type { QuizRow } from "./QuizzesClient";

export default async function QuizzesPage() {
  const me = await requireCompletedProfile();

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
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">המבחנים שלי</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {quizzes.length === 0
              ? "עדיין אין מבחנים."
              : `${quizzes.length} ${quizzes.length === 1 ? "מבחן" : "מבחנים"} בסך הכל`}
          </p>
        </div>
        <Button asChild size="sm" className="gap-1.5">
          <Link href="/study/new">
            <PlusCircle className="h-3.5 w-3.5" />
            מבחן חדש
          </Link>
        </Button>
      </div>

      {quizzes.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <p className="text-muted-foreground text-sm">עדיין לא יצרת מבחנים.</p>
          <Button asChild>
            <Link href="/study/new">
              <PlusCircle className="h-4 w-4 me-1.5" />
              בנה מבחן ראשון
            </Link>
          </Button>
        </div>
      ) : (
        <QuizzesClient quizzes={rows} />
      )}
    </div>
  );
}
