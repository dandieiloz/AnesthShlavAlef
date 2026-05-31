import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { createQuizAction } from "@/app/(user)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuizConfigSection } from "./QuizConfigSection";
import { PlusCircle, ArrowRight, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere } from "@/lib/plan";

export default async function NewQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string; empty?: string }>;
}) {
  const me = await requireCompletedProfile();
  const { chapter, empty } = await searchParams;
  const preselectedChapter = chapter ? Number(chapter) : null;

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.studyNew;

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
      geminiAnswer: { isNot: null },
      AND: [planGate],
    },
    select: { id: true, chapterIds: true },
  });
  const remainingByChapterId = new Map<number, number>();
  const totalByChapterId = new Map<number, number>();
  for (const q of allQuestions) {
    const seen = attemptedIds.has(q.id);
    for (const cid of q.chapterIds) {
      totalByChapterId.set(cid, (totalByChapterId.get(cid) ?? 0) + 1);
      if (!seen) {
        remainingByChapterId.set(cid, (remainingByChapterId.get(cid) ?? 0) + 1);
      }
    }
  }

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
          {locale === "he"
            ? "כבר ענית על כל השאלות בפרקים שבחרת. נסה לבחור פרקים אחרים."
            : "You've already answered every question in the chapters you picked. Try selecting different chapters."}
        </div>
      )}

      <Card>
        <CardContent className="pt-6">
          <form action={createQuizAction} className="space-y-6">
            {/* Chapter picker, question limit, and auto-named quiz name */}
            <QuizConfigSection chapters={rows} preselected={preselected} locale={locale} />

            <Button type="submit" className="w-full gap-2" size="lg">
              <PlusCircle className="h-4 w-4" />
              {t.createQuiz}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
