import { Suspense } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { questionAccessWhere } from "@/lib/plan";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryTable, type HistoryRow } from "./HistoryTable";

const LIMIT = 200;
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";
const SORT_FIELDS = ["stem", "source", "chapter", "attempts", "lastSeen", "lastResult", "communityPercent"] as const;

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
    all?: string;
  }>;
}) {
  const me = await requireCompletedProfile();
  const sp = await searchParams;
  const sort: SortField = isSortField(sp.sort) ? sp.sort : "lastSeen";
  const order: SortOrder = sp.order === "asc" ? "asc" : "desc";
  const isAdmin = me.role === "ADMIN";
  const showAll = isAdmin && sp.all === "1";

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

  // Fetch questions matching the filter. By default we restrict to questions
  // the user has at least one attempt for; admins can opt into showing all.
  const attemptedQuestions = await db.question.findMany({
    where: showAll
      ? questionWhere
      : {
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
    take: showAll ? 5000 : undefined,
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

  // Stats from other users (excluding current user) per question — total + correct.
  const [communityTotalRows, communityCorrectRows] = await Promise.all([
    questionIds.length
      ? db.attempt.groupBy({
          by: ["questionId"],
          where: { questionId: { in: questionIds }, userId: { not: me.id } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { questionId: number; _count: { _all: number } }[]),
    questionIds.length
      ? db.attempt.groupBy({
          by: ["questionId"],
          where: { questionId: { in: questionIds }, isCorrect: true, userId: { not: me.id } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { questionId: number; _count: { _all: number } }[]),
  ]);
  const communityTotalMap = new Map<number, number>(
    communityTotalRows.map((r) => [r.questionId, r._count._all]),
  );
  const communityCorrectMap = new Map<number, number>(
    communityCorrectRows.map((r) => [r.questionId, r._count._all]),
  );

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
      if (!latest && !showAll) return null;
      const communityTotal = communityTotalMap.get(q.id) ?? 0;
      const communityCorrect = communityCorrectMap.get(q.id) ?? 0;
      return {
        id: q.id,
        stem: q.stem,
        source: q.source,
        chapterNumber: q.chapter.number,
        chapterTitle: q.chapter.title,
        attempts: countMap.get(q.id) ?? 0,
        lastSeenAt: latest ? latest.createdAt.toISOString() : null,
        lastChoice: latest ? latest.chosen : null,
        lastCorrect: latest ? latest.isCorrect : null,
        lastQuizId: latest ? latest.quizId : null,
        bookmarked: bookmarkSet.has(q.id),
        communityAttempts: communityTotal,
        communityCorrect,
        communityPercentCorrect:
          communityTotal === 0 ? null : Math.round((communityCorrect / communityTotal) * 100),
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
      case "lastResult": {
        const av = a.lastCorrect === null ? -1 : a.lastCorrect ? 1 : 0;
        const bv = b.lastCorrect === null ? -1 : b.lastCorrect ? 1 : 0;
        return (av - bv) * dir;
      }
      case "communityPercent": {
        const av = a.communityPercentCorrect;
        const bv = b.communityPercentCorrect;
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return (av - bv) * dir;
      }
      case "lastSeen":
      default: {
        const at = a.lastSeenAt ? new Date(a.lastSeenAt).getTime() : 0;
        const bt = b.lastSeenAt ? new Date(b.lastSeenAt).getTime() : 0;
        return (at - bt) * dir;
      }
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
        <HistoryFilters chapters={chapters} isAdmin={isAdmin} />
      </Suspense>

      <div className="text-sm text-muted-foreground">
        {!showAll && totalAttempted === 0
          ? "עדיין לא ניסית שאלות. גש/י ללימוד כדי להתחיל."
          : filteredTotal > LIMIT
            ? `מציג ${LIMIT} מתוך ${filteredTotal} שאלות`
            : `${filteredTotal} שאלות`}
      </div>

      <HistoryTable rows={rows} sort={sort} order={order} />
    </div>
  );
}
