import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { QuestionsFilters } from "./QuestionsFilters";
import { QuestionsTable, type QuestionRow } from "./QuestionsTable";
import { Suspense } from "react";
import { AdminNav } from "../AdminNav";

const LIMIT = 100;
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";
const SORT_FIELDS = ["id", "stem", "source", "chapter", "hasExplanation", "translationCount", "createdAt"] as const;

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
    hasExplanation?: string;
    chapter?: string;
    sort?: string;
    order?: string;
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

  if (sourceFilter === NULL_SOURCE_FILTER) {
    where.source = null;
  } else if (sourceFilter && yearFilter) {
    where.source = { equals: `${sourceFilter} ${yearFilter}` };
  } else if (sourceFilter) {
    where.source = { startsWith: sourceFilter };
  } else if (yearFilter) {
    where.source = { endsWith: ` ${yearFilter}` };
  }

  if (sp.hasExplanation === "yes") {
    where.geminiAnswer = { isNot: null };
  } else if (sp.hasExplanation === "no") {
    where.geminiAnswer = { is: null };
  }

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
              : /* translationCount, createdAt, fallback */ [{ createdAt: order }, { id: "desc" as const }];

  const [questions, total, chapters] = await Promise.all([
    db.question.findMany({
      where,
      select: {
        id: true,
        stem: true,
        source: true,
        createdAt: true,
        chapter: { select: { number: true } },
        geminiAnswer: { select: { id: true } },
      },
      orderBy,
      take: LIMIT,
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

  const rows: QuestionRow[] = questions.map((q) => ({
    id: q.id,
    stem: q.stem,
    source: q.source,
    createdAt: q.createdAt.toISOString(),
    chapterNumber: q.chapter.number,
    hasExplanation: q.geminiAnswer !== null,
    translationCount: translationCountMap.get(q.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <AdminNav />
      <h1 className="font-display text-2xl font-bold">ניהול שאלות</h1>

      <Suspense>
        <QuestionsFilters chapters={chapters} />
      </Suspense>

      <div className="text-sm text-muted-foreground">
        {total > LIMIT
          ? `מציג ${LIMIT} מתוך ${total} שאלות`
          : `${total} שאלות`}
      </div>

      <QuestionsTable questions={rows} sort={sort} order={order} />
    </div>
  );
}
