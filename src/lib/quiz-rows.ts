import { db } from "@/lib/db";
import { getQuizProgressMany } from "@/lib/quiz-progress";
import type { PlanGatedUser } from "@/lib/plan";
import type { QuizRow } from "@/components/quizzes/PracticeList";

/** Fallback pace when the user hasn't answered enough questions to measure one. */
const DEFAULT_SECONDS_PER_QUESTION = 60;
/** Gaps between answers inside this window count as "answering time". */
const MIN_GAP_SEC = 5;
const MAX_GAP_SEC = 10 * 60;
const PACE_SAMPLE = 400;
const MIN_PACE_SAMPLES = 10;
/** Other users' attempts needed before a community average is shown. */
const MIN_COMMUNITY_ATTEMPTS = 20;

/**
 * The user's typical seconds per question: the median gap between consecutive
 * answers, ignoring breaks (gaps over 10 minutes) and double-clicks.
 */
async function getSecondsPerQuestion(userId: string): Promise<number> {
  const recent = await db.attempt.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PACE_SAMPLE,
    select: { createdAt: true },
  });
  const times = recent.map((a) => a.createdAt.getTime()).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < times.length; i++) {
    const sec = (times[i] - times[i - 1]) / 1000;
    if (sec >= MIN_GAP_SEC && sec <= MAX_GAP_SEC) gaps.push(sec);
  }
  if (gaps.length < MIN_PACE_SAMPLES) return DEFAULT_SECONDS_PER_QUESTION;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/**
 * Other users' total and correct attempt counts for every question this user
 * answered inside a quiz. One query, independent of the progress lookups, so
 * it runs in parallel with them.
 */
async function getCommunityCounts(userId: string) {
  const rows = await db.$queryRaw<{ questionId: number; total: number; correct: number }[]>`
    SELECT a."questionId" AS "questionId",
           COUNT(*)::int AS total,
           SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END)::int AS correct
    FROM "Attempt" a
    WHERE a."userId" <> ${userId}
      AND a."questionId" IN (
        SELECT DISTINCT "questionId" FROM "Attempt" WHERE "userId" = ${userId} AND "quizId" IS NOT NULL
      )
    GROUP BY a."questionId"
  `;
  return new Map(rows.map((r) => [r.questionId, { total: r.total, correct: r.correct }]));
}

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

  const [progressMap, chapters, secondsPerQuestion, community] = await Promise.all([
    getQuizProgressMany(user, quizzes),
    db.chapter.findMany({
      where: { id: { in: [...new Set(quizzes.flatMap((q) => q.chapterIds))] } },
      select: { id: true, number: true, title: true },
    }),
    getSecondsPerQuestion(user.id),
    getCommunityCounts(user.id),
  ]);
  const chapterById = new Map(chapters.map((c) => [c.id, c]));


  const rows: QuizRow[] = quizzes.map((q) => {
    const p = progressMap.get(q.id)!;
    const chs = q.chapterIds
      .map((id) => chapterById.get(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .sort((a, b) => a.number - b.number);

    // Other residents' accuracy on exactly the questions answered in this quiz.
    let othersTotal = 0;
    let othersCorrect = 0;
    for (const id of p.answeredQuestionIds) {
      const c = community.get(id);
      if (c) {
        othersTotal += c.total;
        othersCorrect += c.correct;
      }
    }
    const remaining = Math.max(0, p.total - p.answered);

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
      results: p.results,
      accuracyPct: p.accuracyPct,
      minutesLeft: remaining > 0 ? Math.max(1, Math.round((remaining * secondsPerQuestion) / 60)) : null,
      communityPct: othersTotal >= MIN_COMMUNITY_ATTEMPTS ? Math.round((othersCorrect / othersTotal) * 100) : null,
    };
  });

  const activityTime = (r: QuizRow) => new Date(r.lastActivityAt ?? r.createdAt).getTime();
  rows.sort((a, b) => activityTime(b) - activityTime(a));

  return {
    rows: opts.take ? rows.slice(0, opts.take) : rows,
    totalCount: rows.length,
  };
}
