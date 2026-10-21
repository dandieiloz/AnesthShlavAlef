import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hasUsableAnswerWhere, questionAccessWhere, type PlanGatedUser } from "@/lib/plan";

/** The diary lists the user's last few active days, however long ago. */
const DIARY_MAX_ROWS = 7;
/** A chapter needs this many answers before it can be called "weak". */
const WEAK_MIN_ATTEMPTS = 5;
const WEAK_BELOW_PCT = 70;

export interface DiaryDay {
  /** Calendar day in Israel time, "YYYY-MM-DD". */
  date: string;
  answered: number;
  correct: number;
  /** Chapters practiced that day, most-practiced first. */
  chapters: { number: number; title: string; count: number }[];
}

export type NextStep =
  | { kind: "weak"; chapterNumber: number; title: string; accuracyPct: number; attempts: number }
  | { kind: "new"; chapterNumber: number; title: string }
  | null;

const dayKey = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jerusalem",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * The user's most recent active days, grouped by day, plus one
 * suggestion for what to practice next: the weakest chapter with enough
 * answers, or else the most useful chapter not practiced yet.
 */
export async function getPracticeOverview(user: PlanGatedUser): Promise<{ days: DiaryDay[]; next: NextStep }> {
  const attempts = await db.attempt.findMany({
    where: { userId: user.id },
    select: {
      createdAt: true,
      isCorrect: true,
      question: { select: { chapter: { select: { id: true, number: true, title: true } } } },
    },
  });

  // Diary: grouped by Israel calendar day; the newest DIARY_MAX_ROWS are kept.
  const byDay = new Map<string, { answered: number; correct: number; chapters: Map<number, { title: string; count: number }> }>();
  // Per-chapter totals across all time, for the suggestion.
  const byChapter = new Map<number, { id: number; title: string; total: number; correct: number }>();

  for (const a of attempts) {
    const ch = a.question.chapter;
    const c = byChapter.get(ch.number) ?? { id: ch.id, title: ch.title, total: 0, correct: 0 };
    c.total++;
    if (a.isCorrect) c.correct++;
    byChapter.set(ch.number, c);

    const key = dayKey.format(a.createdAt);
    const d = byDay.get(key) ?? { answered: 0, correct: 0, chapters: new Map() };
    d.answered++;
    if (a.isCorrect) d.correct++;
    const dc = d.chapters.get(ch.number) ?? { title: ch.title, count: 0 };
    dc.count++;
    d.chapters.set(ch.number, dc);
    byDay.set(key, d);
  }

  const days: DiaryDay[] = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, DIARY_MAX_ROWS)
    .map(([date, d]) => ({
      date,
      answered: d.answered,
      correct: d.correct,
      chapters: [...d.chapters.entries()]
        .map(([number, v]) => ({ number, title: v.title, count: v.count }))
        .sort((x, y) => y.count - x.count),
    }));

  // Suggestion 1: the weakest chapter with enough answers.
  let next: NextStep = null;
  let weakest: { number: number; title: string; pct: number; total: number } | null = null;
  for (const [number, c] of byChapter) {
    if (c.total < WEAK_MIN_ATTEMPTS) continue;
    const pct = Math.round((c.correct / c.total) * 100);
    if (pct >= WEAK_BELOW_PCT) continue;
    if (!weakest || pct < weakest.pct || (pct === weakest.pct && c.total > weakest.total)) {
      weakest = { number, title: c.title, pct, total: c.total };
    }
  }
  if (weakest) {
    next = { kind: "weak", chapterNumber: weakest.number, title: weakest.title, accuracyPct: weakest.pct, attempts: weakest.total };
  } else {
    // Suggestion 2: the most useful chapter not practiced yet that has questions.
    const planGate = (await questionAccessWhere(user)) as Prisma.QuestionWhereInput;
    const practiced = [...byChapter.values()].map((c) => c.id);
    const available = await db.question.groupBy({
      by: ["chapterId"],
      where: { AND: [planGate, hasUsableAnswerWhere], chapterId: { notIn: practiced } },
      _count: { _all: true },
    });
    const withQuestions = available.filter((r) => r._count._all > 0).map((r) => r.chapterId);
    if (withQuestions.length > 0) {
      const ch = await db.chapter.findFirst({
        where: { id: { in: withQuestions } },
        orderBy: [{ learningUsefulnessIndex: { sort: "desc", nulls: "last" } }, { number: "asc" }],
        select: { number: true, title: true },
      });
      if (ch) next = { kind: "new", chapterNumber: ch.number, title: ch.title };
    }
  }

  return { days, next };
}
