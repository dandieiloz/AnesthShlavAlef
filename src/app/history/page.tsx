import { Suspense } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { questionAccessWhere } from "@/lib/plan";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryTable, type HistoryRow } from "./HistoryTable";

const LIMIT = 200;
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";
const SORT_FIELDS = ["stem", "source", "chapter", "attempts", "lastSeen", "lastResult"] as const;

type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = "asc" | "desc";

function isSortField(value: string | undefined): value is SortField {
  return value !== undefined && SORT_FIELDS.includes(value as SortField);
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    source?: string;
    year?: string;
    chapter?: string;
    result?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  const me = await requireCompletedProfile();
  const sp = await searchParams;
  const sort: SortField = isSortField(sp.sort) ? sp.sort : "lastSeen";
  const order: SortOrder = sp.order === "asc" ? "asc" : "desc";

  const planGate = await questionAccessWhere(me);

  // Build the question filter (same semantics as /admin/questions, minus admin-only fields).
  const questionWhere: Prisma.QuestionWhereInput = { ...(planGate as Prisma.QuestionWhereInput) };

  if (sp.q?.trim()) {
    questionWhere.stem = { contains: sp.q.trim(), mode: "insensitive" };
  }

  const sourceFilter = sp.source?.trim();
  const yearFilter = sp.year?.trim();
  if (sourceFilter === NULL_SOURCE_FILTER) {
    questionWhere.source = null;
  } else if (sourceFilter && yearFilter) {
    questionWhere.source = { equals: `${sourceFilter} ${yearFilter}` };
  } else if (sourceFilter) {
    questionWhere.source = { startsWith: sourceFilter };
  } else if (yearFilter) {
    questionWhere.source = { endsWith: ` ${yearFilter}` };
  }

  if (sp.chapter?.trim()) {
    const chapterNum = Number(sp.chapter.trim());
    if (Number.isFinite(chapterNum) && chapterNum > 0) {
      const chapter = await db.chapter.findUnique({
        where: { number: chapterNum },
        select: { id: true },
      });
      if (chapter) {
        questionWhere.chapterIds = { has: chapter.id };
      }
    }
  }

  // Fetch all questions the user has at least one attempt for that match the filter.
  // Per-user volume is bounded (an active user might attempt ~thousands of questions);
  // we cap output at LIMIT after sorting/filtering by latest-attempt metadata.
  const attemptedQuestions = await db.question.findMany({
    where: {
      AND: [
        questionWhere,
        { attempts: { some: { userId: me.id } } },
      ],
    },
    select: {
      id: true,
      stem: true,
      source: true,
      chapter: { select: { number: true, title: true } },
    },
  });

  const questionIds = attemptedQuestions.map((q) => q.id);
  const totalAttempted = questionIds.length;

  // Per-question attempt count for this user.
  const counts = await db.attempt.groupBy({
    by: ["questionId"],
    where: { userId: me.id, questionId: { in: questionIds } },
    _count: { _all: true },
  });
  const countMap = new Map<number, number>();
  for (const c of counts) countMap.set(c.questionId, c._count._all);

  // Bookmarks the user has on these questions.
  const bookmarks = await db.bookmark.findMany({
    where: { userId: me.id, questionId: { in: questionIds } },
    select: { questionId: true },
  });
  const bookmarkSet = new Set<number>(bookmarks.map((b) => b.questionId));

  // Latest attempt per question (chosen, isCorrect, quizId, createdAt).
  // Postgres-friendly: order by createdAt desc, then keep first per questionId.
  const allAttempts = await db.attempt.findMany({
    where: { userId: me.id, questionId: { in: questionIds } },
    select: { questionId: true, chosen: true, isCorrect: true, quizId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  const latestMap = new Map<number, (typeof allAttempts)[number]>();
  for (const a of allAttempts) {
    if (!latestMap.has(a.questionId)) latestMap.set(a.questionId, a);
  }

  // Apply latest-result filter (post-aggregation).
  const resultFilter = sp.result === "correct" ? true : sp.result === "wrong" ? false : null;

  let rows: HistoryRow[] = attemptedQuestions
    .map((q) => {
      const latest = latestMap.get(q.id);
      if (!latest) return null;
      return {
        id: q.id,
        stem: q.stem,
        source: q.source,
        chapterNumber: q.chapter.number,
        chapterTitle: q.chapter.title,
        attempts: countMap.get(q.id) ?? 0,
        lastSeenAt: latest.createdAt.toISOString(),
        lastChoice: latest.chosen,
        lastCorrect: latest.isCorrect,
        lastQuizId: latest.quizId,
        bookmarked: bookmarkSet.has(q.id),
      } satisfies HistoryRow;
    })
    .filter((r): r is HistoryRow => r !== null);

  if (resultFilter !== null) {
    rows = rows.filter((r) => r.lastCorrect === resultFilter);
  }

  const filteredTotal = rows.length;

  // Sort in JS — fields include per-user aggregates not stored on Question.
  const dir = order === "asc" ? 1 : -1;
  rows.sort((a, b) => {
    switch (sort) {
      case "stem":
        return a.stem.localeCompare(b.stem, "he") * dir;
      case "source":
        return (a.source ?? "").localeCompare(b.source ?? "", "he") * dir;
      case "chapter":
        return (a.chapterNumber - b.chapterNumber) * dir;
      case "attempts":
        return (a.attempts - b.attempts) * dir;
      case "lastResult":
        return ((a.lastCorrect ? 1 : 0) - (b.lastCorrect ? 1 : 0)) * dir;
      case "lastSeen":
      default:
        return (
          (new Date(a.lastSeenAt).getTime() - new Date(b.lastSeenAt).getTime()) * dir
        );
    }
  });

  rows = rows.slice(0, LIMIT);

  const chapters = await db.chapter.findMany({
    select: { number: true, title: true },
    orderBy: { number: "asc" },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">שאלות שראיתי</h1>
        <p className="text-sm text-muted-foreground">
          רשימת השאלות שכבר ניסית, עם התוצאה האחרונה ומספר הניסיונות.
        </p>
      </div>

      <Suspense>
        <HistoryFilters chapters={chapters} />
      </Suspense>

      <div className="text-sm text-muted-foreground">
        {totalAttempted === 0
          ? "עדיין לא ניסית שאלות. גש/י ללימוד כדי להתחיל."
          : filteredTotal > LIMIT
            ? `מציג ${LIMIT} מתוך ${filteredTotal} שאלות`
            : `${filteredTotal} שאלות`}
      </div>

      <HistoryTable rows={rows} sort={sort} order={order} />
    </div>
  );
}
