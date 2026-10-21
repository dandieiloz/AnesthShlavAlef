import { db } from "@/lib/db";
import { getQuizProgressMany } from "@/lib/quiz-progress";
import type { PlanGatedUser } from "@/lib/plan";
import type { QuizRow } from "@/components/quizzes/PracticeList";

/**
 * Load a user's quizzes as display rows, most recently active first.
 * "Active" means the latest answer in the quiz, falling back to creation time
 * for quizzes that were never started.
 */
export async function getQuizRows(user: PlanGatedUser, opts: { take?: number } = {}): Promise<{
  rows: QuizRow[];
  totalCount: number;
}> {
  const quizzes = await db.quiz.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });
  if (quizzes.length === 0) return { rows: [], totalCount: 0 };

  const [progressMap, chapters] = await Promise.all([
    getQuizProgressMany(user, quizzes),
    db.chapter.findMany({
      where: { id: { in: [...new Set(quizzes.flatMap((q) => q.chapterIds))] } },
      select: { id: true, number: true, title: true },
    }),
  ]);
  const chapterById = new Map(chapters.map((c) => [c.id, c]));

  const rows: QuizRow[] = quizzes.map((q) => {
    const p = progressMap.get(q.id)!;
    const chs = q.chapterIds
      .map((id) => chapterById.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.number - b.number);
    return {
      id: q.id,
      name: q.name,
      chapters: chs.map((c) => ({ number: c.number, title: c.title })),
      createdAt: q.createdAt.toISOString(),
      lastActivityAt: p.lastActivityAt?.toISOString() ?? null,
      answered: p.answered,
      total: p.total,
      correct: p.correct,
      wrong: p.answered - p.correct,
      isComplete: p.isComplete,
      accuracyPct: p.accuracyPct,
    };
  });

  const activityTime = (r: QuizRow) => new Date(r.lastActivityAt ?? r.createdAt).getTime();
  rows.sort((a, b) => activityTime(b) - activityTime(a));

  return {
    rows: opts.take ? rows.slice(0, opts.take) : rows,
    totalCount: rows.length,
  };
}
