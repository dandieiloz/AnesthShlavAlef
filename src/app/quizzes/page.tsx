import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { requireCompletedProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getQuizRows } from "@/lib/quiz-rows";
import { PracticeList } from "@/components/quizzes/PracticeList";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlusCircle } from "lucide-react";

export default async function QuizzesPage() {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const t = getDictionary(locale).quizzes;
  const { rows } = await getQuizRows(me);

  return (
    <div className="space-y-6 animate-fade-in">
      <BackLink fallbackHref="/study" label={getDictionary(locale).common.back} dir={locale === "he" ? "rtl" : "ltr"} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.pageSubtitle}</p>
        </div>
        <Button asChild className="gap-1.5">
          <Link href="/study/new">
            <PlusCircle className="h-4 w-4" />
            {t.newQuiz}
          </Link>
        </Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">{t.emptyShort}</CardContent>
        </Card>
      ) : (
        <PracticeList quizzes={rows} locale={locale} showFilters />
      )}
    </div>
  );
}
