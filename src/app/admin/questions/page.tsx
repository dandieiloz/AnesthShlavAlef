import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { QuestionsFilters } from "./QuestionsFilters";
import { QuestionsTable, type QuestionRow } from "./QuestionsTable";
import { PublishThresholdControl } from "./PublishThresholdControl";
import { AutoHideThresholdControl } from "./AutoHideThresholdControl";
import { getPublishConfidenceThreshold } from "@/lib/publish-threshold";
import { getAutoHideConfig, getAutoHiddenQuestionIds } from "@/lib/auto-hide-threshold";
import { Suspense } from "react";
import { AdminNav } from "../AdminNav";

const PAGE_SIZE = 100;
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";
const SORT_FIELDS = ["id", "stem", "source", "chapter", "hasExplanation", "confidence", "escalated", "insufficientEvidence", "algorithmVersion", "translationCount", "attemptCount", "percentCorrect", "createdAt"] as const;

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
    algoVersion?: string;
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
  if (sp.algoVersion === "1") answerIs.algorithmVersion = 1;
  else if (sp.algoVersion === "2") answerIs.algorithmVersion = 2;
  else if (sp.algoVersion === "3") answerIs.algorithmVersion = 3;
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
                    : sort === "algorithmVersion"
                      ? [{ geminiAnswer: { algorithmVersion: order } }, { id: "desc" as const }]
                      : /* translationCount, attemptCount, percentCorrect, createdAt, fallback */ [{ createdAt: order }, { id: "desc" as const }];

  const pageNum = Math.max(1, Number(sp.page) || 1);
  const skip = (pageNum - 1) * PAGE_SIZE;

  const questionSelect = {
    id: true,
    stem: true,
    source: true,
    disabled: true,
    adminApproved: true,
    correctAnswer: true,
    acceptedAnswers: true,
    createdAt: true,
    chapter: { select: { number: true, title: true } },
    geminiAnswer: {
      select: {
        id: true,
        correctAnswer: true,
        confidence: true,
        escalated: true,
        insufficientEvidence: true,
        algorithmVersion: true,
        model: true,
        generationHint: true,
      },
    },
  } as const;

  // attemptCount / percentCorrect are computed from Attempt aggregates and can't
  // be ordered by Prisma. For these we must rank ALL matching questions globally
  // (not just one DB-ordered page) before paginating — otherwise pagination would
  // slice the createdAt-ordered set and only re-sort that local window.
  const isAttemptSort = sort === "attemptCount" || sort === "percentCorrect";

  const [questions, total, chapters] = await Promise.all([
    (async () => {
      if (!isAttemptSort) {
        return db.question.findMany({
          where,
          select: questionSelect,
          orderBy,
          take: PAGE_SIZE,
          skip,
        });
      }

      // Global ranking path: fetch all matching ids, aggregate attempt stats for
      // each, sort by the requested metric, then fetch full rows for the page.
      const allMatching = await db.question.findMany({
        where,
        select: { id: true },
      });
      const allIds = allMatching.map((q) => q.id);

      const [totalRows, correctRows] = allIds.length
        ? await Promise.all([
            db.attempt.groupBy({
              by: ["questionId"],
              where: { questionId: { in: allIds } },
              _count: { _all: true },
            }),
            db.attempt.groupBy({
              by: ["questionId"],
              where: { questionId: { in: allIds }, isCorrect: true },
              _count: { _all: true },
            }),
          ])
        : [[], []];

      const totalByQ = new Map<number, number>(
        totalRows.map((r) => [r.questionId, r._count._all]),
      );
      const correctByQ = new Map<number, number>(
        correctRows.map((r) => [r.questionId, r._count._all]),
      );

      const dir = order === "asc" ? 1 : -1;
      const ranked = allIds
        .map((id) => {
          const attempts = totalByQ.get(id) ?? 0;
          const correct = correctByQ.get(id) ?? 0;
          const pct = attempts === 0 ? null : correct / attempts;
          return { id, attempts, pct };
        })
        .sort((a, b) => {
          if (sort === "attemptCount") {
            return (a.attempts - b.attempts) * dir || b.id - a.id;
          }
          // null percentCorrect (no attempts) always sorts to the end
          if (a.pct === null && b.pct === null) return b.id - a.id;
          if (a.pct === null) return 1;
          if (b.pct === null) return -1;
          return (a.pct - b.pct) * dir || b.id - a.id;
        });

      const pageIds = ranked.slice(skip, skip + PAGE_SIZE).map((r) => r.id);
      const pageRows = await db.question.findMany({
        where: { id: { in: pageIds } },
        select: questionSelect,
      });
      // Preserve the global ranking order (findMany ignores `in` ordering).
      const byId = new Map(pageRows.map((q) => [q.id, q]));
      return pageIds.map((id) => byId.get(id)!).filter(Boolean);
    })(),
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

  // Learner-visibility gates (do NOT set `disabled`): a question is filtered out
  // of the learner-facing pool when it is neither disabled nor admin-approved and
  // either its answer confidence is below the publish threshold (סף) or it falls
  // under the auto-hide performance rule.
  const publishThreshold = await getPublishConfidenceThreshold();
  const autoHideConfig = await getAutoHideConfig();
  const autoHiddenIds = await getAutoHiddenQuestionIds(autoHideConfig);
  const autoHiddenSet = new Set(autoHiddenIds);

  const rows: QuestionRow[] = questions.map((q) => {
    const attemptCount = attemptCountMap.get(q.id) ?? 0;
    const correctCount = correctCountMap.get(q.id) ?? 0;
    const confidence = q.geminiAnswer?.confidence ?? null;
    const exemptFromGates = q.disabled || q.adminApproved;
    const belowThreshold =
      !exemptFromGates && (confidence === null || confidence < publishThreshold);
    const autoHidden = !exemptFromGates && autoHiddenSet.has(q.id);
    return {
      id: q.id,
      stem: q.stem,
      source: q.source,
      createdAt: q.createdAt.toISOString(),
      chapterNumber: q.chapter.number,
      chapterTitle: q.chapter.title,
      hasExplanation: q.geminiAnswer !== null,
      disabled: q.disabled,
      // Effective answer learners actually see: Gemini's answer takes precedence,
      // falling back to an admin-set official answer (mirrors grading logic elsewhere).
      correctAnswer: q.geminiAnswer?.correctAnswer ?? q.correctAnswer,
      correctAnswerSource: q.geminiAnswer?.correctAnswer
        ? ("gemini" as const)
        : q.correctAnswer
          ? ("admin" as const)
          : null,
      acceptedAnswersCount: q.acceptedAnswers.length,
      confidence,
      belowThreshold,
      autoHidden,
      adminApproved: q.adminApproved,
      escalated: q.geminiAnswer?.escalated ?? null,
      insufficientEvidence: q.geminiAnswer?.insufficientEvidence ?? null,
      algorithmVersion: q.geminiAnswer?.algorithmVersion ?? null,
      model: q.geminiAnswer?.model ?? null,
      generationHint: q.geminiAnswer?.generationHint ?? null,
      translationCount: translationCountMap.get(q.id) ?? 0,
      attemptCount,
      correctCount,
      percentCorrect: attemptCount === 0 ? null : Math.round((correctCount / attemptCount) * 100),
    };
  });

  // attemptCount / percentCorrect ordering is handled globally before pagination
  // (see the ranking path above), so the page rows already arrive in the correct
  // order here. All other sorts came back ordered from Prisma.

  // Threshold controls: compute how many questions each gate currently hides from
  // learners (excludes admin-approved and already-disabled questions, which the
  // gates never hide). publishThreshold / autoHideConfig / autoHiddenIds are
  // computed above for per-row gate flags.
  const [publishFilteredCount, autoHideFilteredCount, availableToUsersCount] = await Promise.all([
    db.question.count({
      where: {
        disabled: false,
        adminApproved: false,
        NOT: { geminiAnswer: { is: { confidence: { gte: publishThreshold } } } },
      },
    }),
    autoHiddenIds.length
      ? db.question.count({
          where: { disabled: false, adminApproved: false, id: { in: autoHiddenIds } },
        })
      : Promise.resolve(0),
    // Questions actually visible to learners: not disabled AND pass the publish
    // gate AND (admin-approved OR not auto-hidden). Mirrors the learner gate in
    // lib/plan.ts.
    db.question.count({
      where: {
        disabled: false,
        AND: [
          {
            OR: [
              { adminApproved: true },
              { geminiAnswer: { is: { confidence: { gte: publishThreshold } } } },
            ],
          },
          ...(autoHiddenIds.length
            ? [{ OR: [{ adminApproved: true }, { id: { notIn: autoHiddenIds } }] }]
            : []),
        ],
      },
    }),
  ]);

  return (
    <div className="space-y-4">
      <AdminNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">ניהול שאלות</h1>
        <div
          className="inline-flex items-center gap-3 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-2 shadow-sm dark:border-emerald-900/50 dark:from-emerald-950/40 dark:to-teal-950/30"
          title="שאלות הגלויות ללומדים לאחר סינון: לא מושבתות, מעל סף הביטחון, ולא מוסתרות אוטומטית"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </span>
          <div className="leading-tight">
            <div className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
              {availableToUsersCount.toLocaleString("he-IL")}
            </div>
            <div className="text-[11px] font-medium text-emerald-700/80 dark:text-emerald-400/80">
              זמינות ללומדים
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <PublishThresholdControl
          initialThreshold={publishThreshold}
          filteredCount={publishFilteredCount}
        />
        <AutoHideThresholdControl
          initialMinAttempts={autoHideConfig.minAttempts}
          initialMaxCorrectPercent={autoHideConfig.maxCorrectPercent}
          filteredCount={autoHideFilteredCount}
        />
      </div>

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
