import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { QuestionsFilters } from "./QuestionsFilters";
import { QuestionsTable, type QuestionRow } from "./QuestionsTable";
import { Suspense } from "react";

const LIMIT = 100;
const NULL_SOURCE_FILTER = "__NULL_SOURCE__";

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string; year?: string; hasExplanation?: string; chapter?: string }>;
}) {
  await requireAdmin();
  const sp = await searchParams;

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
    where.source = { endsWith: ` ${sp.year.trim()}` };
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

  const [questions, total, chapters] = await Promise.all([
    db.question.findMany({
      where,
      select: {
        id: true,
        stem: true,
        source: true,
        chapter: { select: { number: true } },
        geminiAnswer: { select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    db.question.count({ where }),
    db.chapter.findMany({
      select: { number: true, title: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const rows: QuestionRow[] = questions.map((q) => ({
    id: q.id,
    stem: q.stem,
    source: q.source,
    chapterNumber: q.chapter.number,
    hasExplanation: q.geminiAnswer !== null,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold">ניהול שאלות</h1>
        <Link href="/admin" className="text-sm text-primary hover:underline">
          ← חזרה לניהול
        </Link>
      </div>

      <Suspense>
        <QuestionsFilters chapters={chapters} />
      </Suspense>

      <div className="text-sm text-muted-foreground">
        {total > LIMIT
          ? `מציג ${LIMIT} מתוך ${total} שאלות`
          : `${total} שאלות`}
      </div>

      <QuestionsTable questions={rows} />
    </div>
  );
}
