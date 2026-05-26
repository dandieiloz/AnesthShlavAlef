import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { createQuizAction } from "@/app/(user)/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QuizConfigSection } from "./QuizConfigSection";
import { PlusCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default async function NewQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ chapter?: string }>;
}) {
  await requireCompletedProfile();
  const { chapter } = await searchParams;
  const preselectedChapter = chapter ? Number(chapter) : null;

  const chapters = await db.chapter.findMany({
    orderBy: { number: "asc" },
    include: {
      _count: { select: { questions: { where: { geminiAnswer: { isNot: null } } } } },
    },
  });

  const rows = chapters.map((c) => ({
    id: c.id,
    number: c.number,
    title: c.title,
    learningUsefulnessIndex: c.learningUsefulnessIndex,
    questionCount: c._count.questions,
  }));

  // Pre-select chapter by number if query-param given
  const preselected: number[] = [];
  if (preselectedChapter !== null) {
    const found = rows.find((r) => r.number === preselectedChapter);
    if (found) preselected.push(found.id);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/study"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="h-4 w-4" />
          חזרה ללימוד
        </Link>
      </div>

      <div>
        <h1 className="font-display text-2xl font-bold">בנו מבחן מותאם</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          בחרו פרקים, שמו למבחן, והתחילו.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form action={createQuizAction} className="space-y-6">
            {/* Chapter picker, question limit, and auto-named quiz name */}
            <QuizConfigSection chapters={rows} preselected={preselected} />

            <Button type="submit" className="w-full gap-2" size="lg">
              <PlusCircle className="h-4 w-4" />
              צרו מבחן
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
