import { Suspense } from "react";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { questionAccessWhere, type PlanGatedUser } from "@/lib/plan";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { HistoryFilters } from "./HistoryFilters";
import { HistoryTable, type HistoryRow } from "./HistoryTable";

const LIMIT = 200;
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";
const SORT_FIELDS = ["stem", "source", "chapter", "attempts", "lastSeen", "lastResult", "communityPercent"] as const;

type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = "asc" | "desc";

export type HistorySearchParams = {
  q?: string;
  source?: string;
  year?: string;
  chapter?: string;
  result?: string;
  sort?: string;
  order?: string;
  all?: string;
};

function isSortField(value: string | undefined): value is SortField {
  return value !== undefined && SORT_FIELDS.includes(value as SortField);
}

/**
 * Table of questions the user has attempted. In "wrong" mode it only lists
 * questions whose latest attempt was wrong (the "Got wrong" tab).
 */
export async function HistoryView({
  me,
  sp,
  mode,
  locale,
}: {
  me: PlanGatedUser;
  sp: HistorySearchParams;
  mode: "all" | "wrong";
  locale: Locale;
}) {
  const dict = getDictionary(locale);
  const t = dict.myQuestions;
  const sort: SortField = isSortField(sp.sort) ? sp.sort : "lastSeen";
  const order: SortOrder = sp.order === "asc" ? "asc" : "desc";
  const isAdmin = me.role === "ADMIN";
  const showAll = mode === "all" && isAdmin && sp.all === "1";

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

  // By default we restrict to questions the user has at least one attempt
  // for; admins can opt into showing all.
  const attemptedQuestions = await db.question.findMany({
    where: showAll
      ? questionWhere
      : {
          AND: [questionWhere, { attempts: { some: { userId: me.id } } }],
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

  const [counts, communityTotalRows, communityCorrectRows, bookmarks, allAttempts, chapters] = await Promise.all([
    db.attempt.groupBy({
      by: ["questionId"],
      where: { userId: me.id, questionId: { in: questionIds } },
      _count: { _all: true },
    }),
    // Stats from other users (excluding current user) per question.
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
    db.bookmark.findMany({
      where: { userId: me.id, questionId: { in: questionIds } },
      select: { questionId: true },
    }),
    // Newest first, so the first row per question is the latest attempt.
    db.attempt.findMany({
      where: { userId: me.id, questionId: { in: questionIds } },
      select: { questionId: true, chosen: true, isCorrect: true, quizId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.chapter.findMany({
      select: { number: true, title: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const countMap = new Map<number, number>(counts.map((c) => [c.questionId, c._count._all]));
  const communityTotalMap = new Map<number, number>(communityTotalRows.map((r) => [r.questionId, r._count._all]));
  const communityCorrectMap = new Map<number, number>(communityCorrectRows.map((r) => [r.questionId, r._count._all]));
  const bookmarkSet = new Set<number>(bookmarks.map((b) => b.questionId));
  const latestMap = new Map<number, (typeof allAttempts)[number]>();
  for (const a of allAttempts) {
    if (!latestMap.has(a.questionId)) latestMap.set(a.questionId, a);
  }

  // Latest-result filter (post-aggregation). The "wrong" tab forces it.
  const resultFilter =
    mode === "wrong" ? false : sp.result === "correct" ? true : sp.result === "wrong" ? false : null;

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

  // Nothing attempted at all: point the user at a quiz instead of empty filters.
  if (!showAll && totalAttempted === 0 && !sp.q && !sp.source && !sp.year && !sp.chapter) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-14 text-center">
          <p className="text-sm text-muted-foreground">{t.empty}</p>
          <Button asChild size="sm">
            <Link href="/study/new">{dict.homePage.newQuiz}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {mode === "wrong" && <p className="text-sm text-muted-foreground">{t.wrongHint}</p>}

      <Suspense>
        <HistoryFilters chapters={chapters} isAdmin={isAdmin && mode === "all"} tab={mode} showResultFilter={mode === "all"} t={t} />
      </Suspense>

      <div className="text-sm text-muted-foreground">
        {filteredTotal > LIMIT
          ? t.showingOf.replace("{shown}", String(LIMIT)).replace("{total}", String(filteredTotal))
          : t.count.replace("{n}", String(filteredTotal))}
      </div>

      {mode === "wrong" && filteredTotal === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">{t.emptyWrong}</CardContent>
        </Card>
      ) : (
        <HistoryTable rows={rows} sort={sort} order={order} t={t} locale={locale} />
      )}
    </div>
  );
}
