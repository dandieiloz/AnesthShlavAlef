import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { createQuizAction } from "@/app/(user)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { QuizConfigSection } from "./QuizConfigSection";
import { ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere, hasUsableAnswerWhere } from "@/lib/plan";
import { OFFICIAL_EXAM_SOURCE } from "@/lib/hospitals";
import type { ConfidenceLevel } from "@/lib/scores/types";

export default async function NewQuizPage({
  searchParams,
}: {
  searchParams: Promise<{
    chapter?: string;
    empty?: string;
    mode?: string;
    inst?: string;
    year?: string;
  }>;
}) {
  const me = await requireCompletedProfile();
  const { chapter, empty, mode, inst, year } = await searchParams;
  const preselectedChapter = chapter ? Number(chapter) : null;
  const initialMode: "chapters" | "exam" | "scores" =
    mode === "exam" ? "exam" : mode === "scores" ? "scores" : "chapters";

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.studyNew;

  const scoreConfidence = await db.scoreConfidence.findMany({
    where: { userId: me.id },
    select: { scoreId: true, level: true },
  });
  const confidenceMap: Record<string, ConfidenceLevel> = {};
  for (const sc of scoreConfidence) confidenceMap[sc.scoreId] = sc.level;

  const chapters = await db.chapter.findMany({
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      title: true,
      learningUsefulnessIndex: true,
    },
  });

  // Count questions per chapter using chapterIds[] — same membership +
  // plan-gate rules the quiz pool uses in createQuizAction. Compute both
  // "remaining" (un-attempted) and "total" so the client can switch counts
  // based on the "include questions I've already seen" toggle.
  const planGate = await questionAccessWhere(me);
  const attempted = await db.attempt.findMany({
    where: { userId: me.id },
    select: { questionId: true },
    distinct: ["questionId"],
  });
  const attemptedIds = new Set(attempted.map((a) => a.questionId));
  const allQuestions = await db.question.findMany({
    where: {
      AND: [planGate, hasUsableAnswerWhere],
    },
    select: { id: true, chapterIds: true, source: true },
  });
  const remainingByChapterId = new Map<number, number>();
  const totalByChapterId = new Map<number, number>();
  const remainingNonOfficialByChapterId = new Map<number, number>();
  const totalNonOfficialByChapterId = new Map<number, number>();
  // Past-exam mode: group by institute, then by yearKey ("<year>" or "<year> <suffix>").
  type ExamCounts = { year: number; suffix: string; total: number; remaining: number };
  const examMap = new Map<string, Map<string, ExamCounts>>(); // institute -> yearKey -> counts
  for (const q of allQuestions) {
    const seen = attemptedIds.has(q.id);
    const isOfficial = q.source?.startsWith(OFFICIAL_EXAM_SOURCE) ?? false;
    for (const cid of q.chapterIds) {
      totalByChapterId.set(cid, (totalByChapterId.get(cid) ?? 0) + 1);
      if (!seen) {
        remainingByChapterId.set(cid, (remainingByChapterId.get(cid) ?? 0) + 1);
      }
      if (!isOfficial) {
        totalNonOfficialByChapterId.set(cid, (totalNonOfficialByChapterId.get(cid) ?? 0) + 1);
        if (!seen) {
          remainingNonOfficialByChapterId.set(
            cid,
            (remainingNonOfficialByChapterId.get(cid) ?? 0) + 1,
          );
        }
      }
    }
    if (q.source) {
      const m = q.source.match(/^(.+?)\s+(\d{4})(?:\s+(.+))?$/);
      if (m) {
        const institute = m[1];
        const yr = Number(m[2]);
        const suffix = m[3] ?? "";
        const yearKey = suffix ? `${yr} ${suffix}` : `${yr}`;
        let yearMap = examMap.get(institute);
        if (!yearMap) {
          yearMap = new Map();
          examMap.set(institute, yearMap);
        }
        const counts = yearMap.get(yearKey) ?? { year: yr, suffix, total: 0, remaining: 0 };
        counts.total += 1;
        if (!seen) counts.remaining += 1;
        yearMap.set(yearKey, counts);
      }
    }
  }

  // Shape exam options for the client: sorted institutes, each with sorted yearKeys (year desc, suffix asc).
  const examOptions = [...examMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "he"))
    .map(([institute, yearMap]) => ({
      institute,
      years: [...yearMap.entries()]
        .sort(([aKey, aVal], [bKey, bVal]) => {
          if (bVal.year !== aVal.year) return bVal.year - aVal.year;
          return aKey.localeCompare(bKey, "he");
        })
        .map(([, counts]) => ({
          year: counts.year,
          suffix: counts.suffix,
          total: counts.total,
          remaining: counts.remaining,
        })),
    }));

  const titles = await Promise.all(
    chapters.map((c) =>
      getTranslatedFields("Chapter", String(c.id), { title: c.title }, locale)
    )
  );

  const rows = chapters.map((c, i) => ({
    id: c.id,
    number: c.number,
    title: titles[i].title,
    learningUsefulnessIndex: c.learningUsefulnessIndex,
    questionCount: remainingByChapterId.get(c.id) ?? 0,
    totalQuestionCount: totalByChapterId.get(c.id) ?? 0,
    questionCountNonOfficial: remainingNonOfficialByChapterId.get(c.id) ?? 0,
    totalQuestionCountNonOfficial: totalNonOfficialByChapterId.get(c.id) ?? 0,
  }));

  // Pre-select chapter by number if query-param given
  const preselected: number[] = [];
  if (preselectedChapter !== null) {
    const found = rows.find((r) => r.number === preselectedChapter);
    if (found) preselected.push(found.id);
  }

  const BackIcon = locale === "he" ? ArrowRight : ArrowLeft;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/study"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <BackIcon className="h-4 w-4" />
          {t.backToStudy}
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {empty === "1" && (
        <div
          role="alert"
          className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100"
        >
          {initialMode === "exam"
            ? locale === "he"
              ? "כבר ענית על כל השאלות במבחן שבחרת. נסה לבחור מבחן אחר."
              : "You've already answered every question in that exam. Try a different one."
            : locale === "he"
            ? "כבר ענית על כל השאלות בפרקים שבחרת. נסה לבחור פרקים אחרים."
            : "You've already answered every question in the chapters you picked. Try selecting different chapters."}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form action={createQuizAction} className="space-y-6">
            {/* Chapter picker, question limit, and auto-named quiz name */}
            <QuizConfigSection
              chapters={rows}
              preselected={preselected}
              locale={locale}
              examOptions={examOptions}
              initialMode={initialMode}
              initialInstitute={inst ?? null}
              initialYear={year ?? null}
              confidence={confidenceMap}
            />
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
