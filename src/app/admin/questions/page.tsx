import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { QuestionsFilters } from "./QuestionsFilters";
import { QuestionsTable, type QuestionRow } from "./QuestionsTable";
import { PublishThresholdControl } from "./PublishThresholdControl";
import { getPublishConfidenceThreshold } from "@/lib/publish-threshold";
import { Suspense } from "react";
import { AdminNav } from "../AdminNav";

const PAGE_SIZE = 100;
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";
const SORT_FIELDS = ["id", "stem", "source", "chapter", "hasExplanation", "confidence", "escalated", "insufficientEvidence", "translationCount", "attemptCount", "percentCorrect", "createdAt"] as const;

type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = "asc" | "desc";

function isSortField(value: string | undefined): value is SortField {
  return value !== undefined && SORT_FIELDS.includes(value as SortField);
}

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    source?: string;
    year?: string;
    suffix?: string;
    hasExplanation?: string;
    chapter?: string;
    confidence?: string;
    escalated?: string;
    insufficient?: string;
    hint?: string;
    status?: string;
    sort?: string;
    order?: string;
    page?: string;
  }>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const sort: SortField = isSortField(sp.sort) ? sp.sort : "createdAt";
  const order: SortOrder = sp.order === "asc" ? "asc" : "desc";

  // Build Prisma where clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (sp.q?.trim()) {
    where.stem = { contains: sp.q.trim(), mode: "insensitive" };
  }

  const sourceFilter = sp.source?.trim();
  const yearFilter = sp.year?.trim();
  const suffixFilter = sp.suffix?.trim();

  if (sourceFilter === NULL_SOURCE_FILTER) {
    where.source = null;
  } else if (sourceFilter && yearFilter && suffixFilter) {
    where.source = { equals: `${sourceFilter} ${yearFilter} ${suffixFilter}` };
  } else if (sourceFilter && yearFilter) {
    where.source = { startsWith: `${sourceFilter} ${yearFilter}` };
  } else if (sourceFilter && suffixFilter) {
    where.AND = [
      { source: { startsWith: sourceFilter } },
      { source: { endsWith: ` ${suffixFilter}` } },
    ];
  } else if (yearFilter && suffixFilter) {
    where.source = { contains: ` ${yearFilter} ${suffixFilter}` };
  } else if (sourceFilter) {
    where.source = { startsWith: sourceFilter };
  } else if (yearFilter) {
    where.source = { contains: ` ${yearFilter}` };
  } else if (suffixFilter) {
    where.source = { endsWith: ` ${suffixFilter}` };
  }

  // Quality predicates on the related GeminiAnswer.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const answerIs: any = {};
  if (sp.confidence === "lt50") answerIs.confidence = { lt: 0.5 };
  else if (sp.confidence === "lt70") answerIs.confidence = { lt: 0.7 };
  else if (sp.confidence === "gte70") answerIs.confidence = { gte: 0.7 };
  if (sp.escalated === "yes") answerIs.escalated = true;
  else if (sp.escalated === "no") answerIs.escalated = false;
  if (sp.insufficient === "yes") answerIs.insufficientEvidence = true;
  else if (sp.insufficient === "no") answerIs.insufficientEvidence = false;
  if (sp.hint === "yes") answerIs.generationHint = { not: null };
  else if (sp.hint === "no") answerIs.generationHint = null;
  const hasAnswerFilter = Object.keys(answerIs).length > 0;

  if (sp.hasExplanation === "no") {
    where.geminiAnswer = { is: null };
  } else if (sp.hasExplanation === "yes" || hasAnswerFilter) {
    where.geminiAnswer = hasAnswerFilter ? { is: answerIs } : { isNot: null };
  }

  if (sp.status === "disabled") where.disabled = true;
  else if (sp.status === "all") {
    // no filter
  } else where.disabled = false; // default: active only

  if (sp.chapter?.trim()) {
    const chapterNum = Number(sp.chapter.trim());
    if (Number.isFinite(chapterNum) && chapterNum > 0) {
      const chapter = await db.chapter.findUnique({
        where: { number: chapterNum },
        select: { id: true },
      });
      if (chapter) {
        where.chapterIds = { has: chapter.id };
      }
    }
  }

  const orderBy =
    sort === "id"
      ? [{ id: order }, { createdAt: "desc" as const }]
      : sort === "stem"
        ? [{ stem: order }, { id: "desc" as const }]
        : sort === "source"
          ? [{ source: order }, { id: "desc" as const }]
          : sort === "chapter"
            ? [{ chapter: { number: order } }, { id: "desc" as const }]
            : sort === "hasExplanation"
              ? [{ geminiAnswer: { id: order } }, { id: "desc" as const }]
              : sort === "confidence"
                ? [{ geminiAnswer: { confidence: order } }, { id: "desc" as const }]
                : sort === "escalated"
                  ? [{ geminiAnswer: { escalated: order } }, { id: "desc" as const }]
                  : sort === "insufficientEvidence"
                    ? [{ geminiAnswer: { insufficientEvidence: order } }, { id: "desc" as const }]
                    : /* translationCount, attemptCount, percentCorrect, createdAt, fallback */ [{ createdAt: order }, { id: "desc" as const }];

  const pageNum = Math.max(1, Number(sp.page) || 1);
  const skip = (pageNum - 1) * PAGE_SIZE;

  const [questions, total, chapters] = await Promise.all([
    db.question.findMany({
      where,
      select: {
        id: true,
        stem: true,
        source: true,
        disabled: true,
        correctAnswer: true,
        acceptedAnswers: true,
        createdAt: true,
        chapter: { select: { number: true } },
        geminiAnswer: {
          select: {
            id: true,
            confidence: true,
            escalated: true,
            insufficientEvidence: true,
            generationHint: true,
          },
        },
      },
      orderBy,
      take: PAGE_SIZE,
      skip,
    }),
    db.question.count({ where }),
    db.chapter.findMany({
      select: { number: true, title: true },
      orderBy: { number: "asc" },
    }),
  ]);

  // Count cached EN translation fields per question (stem + 4 options = 5 fields for Question;
  // explanation + whyOthersWrong = 2 fields for GeminiAnswer). Max = 7.
  const questionIds = questions.map((q) => q.id);
  const translationRows = await db.translation.groupBy({
    by: ["entityId"],
    where: {
      locale: "en",
      entityType: { in: ["Question", "GeminiAnswer"] },
      entityId: {
        in: [
          ...questionIds.map(String),
          ...questions.filter((q) => q.geminiAnswer).map((q) => String(q.geminiAnswer!.id)),
        ],
      },
    },
    _count: { field: true },
  });

  // Build a map: questionId → total cached field count (combining Question + GeminiAnswer rows)
  const questionIdSet = new Set(questionIds.map(String));
  // geminiAnswerId → questionId
  const answerToQuestion = new Map(
    questions.filter((q) => q.geminiAnswer).map((q) => [String(q.geminiAnswer!.id), q.id]),
  );
  const translationCountMap = new Map<number, number>();
  for (const row of translationRows) {
    const qId = questionIdSet.has(row.entityId)
      ? Number(row.entityId)
      : answerToQuestion.get(row.entityId);
    if (qId === undefined) continue;
    translationCountMap.set(qId, (translationCountMap.get(qId) ?? 0) + row._count.field);
  }

  // Per-question attempt stats: total attempts and correct attempts.
  const [attemptTotalRows, attemptCorrectRows] = await Promise.all([
    questionIds.length
      ? db.attempt.groupBy({
          by: ["questionId"],
          where: { questionId: { in: questionIds } },
          _count: { _all: true },
        })
      : Promise.resolve([] as { questionId: number; _count: { _all: number } }[]),
    questionIds.length
      ? db.attempt.groupBy({
          by: ["questionId"],
          where: { questionId: { in: questionIds }, isCorrect: true },
          _count: { _all: true },
        })
      : Promise.resolve([] as { questionId: number; _count: { _all: number } }[]),
  ]);
  const attemptCountMap = new Map<number, number>(
    attemptTotalRows.map((r) => [r.questionId, r._count._all]),
  );
  const correctCountMap = new Map<number, number>(
    attemptCorrectRows.map((r) => [r.questionId, r._count._all]),
  );

  let rows: QuestionRow[] = questions.map((q) => {
    const attemptCount = attemptCountMap.get(q.id) ?? 0;
    const correctCount = correctCountMap.get(q.id) ?? 0;
    return {
      id: q.id,
      stem: q.stem,
      source: q.source,
      createdAt: q.createdAt.toISOString(),
      chapterNumber: q.chapter.number,
      hasExplanation: q.geminiAnswer !== null,
      disabled: q.disabled,
      correctAnswer: q.correctAnswer,
      acceptedAnswersCount: q.acceptedAnswers.length,
      confidence: q.geminiAnswer?.confidence ?? null,
      escalated: q.geminiAnswer?.escalated ?? null,
      insufficientEvidence: q.geminiAnswer?.insufficientEvidence ?? null,
      generationHint: q.geminiAnswer?.generationHint ?? null,
      translationCount: translationCountMap.get(q.id) ?? 0,
      attemptCount,
      correctCount,
      percentCorrect: attemptCount === 0 ? null : Math.round((correctCount / attemptCount) * 100),
    };
  });

  // attemptCount / percentCorrect can't be ordered in the DB query — sort the
  // current page in memory. Other sorts already came back ordered from Prisma.
  if (sort === "attemptCount" || sort === "percentCorrect") {
    const dir = order === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sort === "attemptCount") {
        return (a.attemptCount - b.attemptCount) * dir || (b.id - a.id);
      }
      // null percentCorrect (no attempts) sorts to the end regardless of direction
      const av = a.percentCorrect;
      const bv = b.percentCorrect;
      if (av === null && bv === null) return b.id - a.id;
      if (av === null) return 1;
      if (bv === null) return -1;
      return (av - bv) * dir || (b.id - a.id);
    });
  }

  return (
    <div className="space-y-4">
      <AdminNav />
      <h1 className="font-display text-2xl font-bold">ניהול שאלות</h1>

      <PublishThresholdControl initialThreshold={await getPublishConfidenceThreshold()} />

      <Suspense>
        <QuestionsFilters chapters={chapters} />
      </Suspense>

      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <div>
          {total === 0
            ? "אין שאלות"
            : `מציג ${skip + 1}\u2013${Math.min(skip + rows.length, total)} מתוך ${total} שאלות`}
        </div>
        <Pagination total={total} page={pageNum} pageSize={PAGE_SIZE} searchParams={sp} />
      </div>

      <QuestionsTable questions={rows} sort={sort} order={order} />
    </div>
  );
}

function Pagination({
  total,
  page,
  pageSize,
  searchParams,
}: {
  total: number;
  page: number;
  pageSize: number;
  searchParams: Record<string, string | undefined>;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(p: number) {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) {
      if (typeof v === "string" && v.trim() && k !== "page") sp.set(k, v);
    }
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `/admin/questions?${qs}` : "/admin/questions";
  }

  const prev = Math.max(1, page - 1);
  const next = Math.min(totalPages, page + 1);

  return (
    <div className="flex items-center gap-2">
      <a
        href={hrefFor(1)}
        aria-disabled={page === 1}
        className={`rounded border px-2 py-1 text-xs ${page === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}
      >
        « ראשון
      </a>
      <a
        href={hrefFor(prev)}
        aria-disabled={page === 1}
        className={`rounded border px-2 py-1 text-xs ${page === 1 ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}
      >
        ‹ הקודם
      </a>
      <span className="px-2 text-xs">
        עמוד {page} / {totalPages}
      </span>
      <a
        href={hrefFor(next)}
        aria-disabled={page === totalPages}
        className={`rounded border px-2 py-1 text-xs ${page === totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}
      >
        הבא ›
      </a>
      <a
        href={hrefFor(totalPages)}
        aria-disabled={page === totalPages}
        className={`rounded border px-2 py-1 text-xs ${page === totalPages ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}
      >
        אחרון »
      </a>
    </div>
  );
}
