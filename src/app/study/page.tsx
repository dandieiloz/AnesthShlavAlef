import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getQuizProgressMany } from "@/lib/quiz-progress";
import { usefulnessTone, TONE_DOT_CLASS, TONE_BADGE_CLASS, toneLabel } from "@/lib/usefulness";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";
import {
  PlusCircle,
  ArrowLeft,
  Clock,
  CheckCircle2,
  BookOpen,
  Layers,
  Play,
} from "lucide-react";

function relativeDate(date: Date, locale: "he" | "en", t: { today: string; yesterday: string }): string {
  const diffDays = Math.floor(
    (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (diffDays === 0) return t.today;
  if (diffDays === 1) return t.yesterday;
  return date.toLocaleDateString(locale === "he" ? "he-IL" : "en-US");
}

function residencyLabel(year: number | null, t: { yearLabels: Record<number, string>; yearLabel: (n: number) => string }): string {
  if (!year) return "";
  return t.yearLabels[year] ?? t.yearLabel(year);
}

export default async function StudyPage() {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const t = getDictionary(locale).study;

  const [allQuizzes, dbUser, topChapters] = await Promise.all([
    db.quiz.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findUnique({
      where: { id: me.id },
      select: { residencyYear: true },
    }),
    db.chapter.findMany({
      orderBy: [
        { learningUsefulnessIndex: { sort: "asc", nulls: "last" } },
        { number: "asc" },
      ],
      take: 5,
      include: {
        _count: { select: { questions: { where: { geminiAnswer: { isNot: null } } } } },
      },
    }),
  ]);

  const progressMap = await getQuizProgressMany(allQuizzes);

  const topChapterTitles = await Promise.all(
    topChapters.map((c) =>
      getTranslatedFields("Chapter", String(c.id), { title: c.title }, locale),
    ),
  );

  const inProgress = allQuizzes.filter((q) => {
    const p = progressMap.get(q.id);
    return p && !p.isComplete && p.answered > 0;
  });

  const recentCompleted = allQuizzes
    .filter((q) => progressMap.get(q.id)?.isComplete)
    .slice(0, 5);

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">
            {me.name ? t.greeting(me.name.split(" ")[0]) : t.greetingAnon}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.tagline}</p>
        </div>
        {dbUser?.residencyYear && (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            {residencyLabel(dbUser.residencyYear, t)}
          </Badge>
        )}
      </div>

      {/* In-progress quizzes */}
      {inProgress.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Play className="h-4 w-4 text-primary" />
            {t.continueQuiz}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {inProgress.map((q) => {
              const p = progressMap.get(q.id)!;
              return (
                <Link key={q.id} href={`/quiz/${q.id}`}>
                  <Card className="group transition-all hover:shadow-md hover:-translate-y-0.5">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm group-hover:text-primary transition-colors line-clamp-1">
                          {q.name}
                        </p>
                        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                          {p.answered}/{p.total}
                        </span>
                      </div>
                      <Progress value={(p.answered / p.total) * 100} className="h-1.5" />
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {p.lastActivityAt ? relativeDate(p.lastActivityAt, locale, t) : ""}
                        </span>
                        <span className="text-primary font-medium">{t.continue}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Start new quiz */}
      <section className="space-y-4">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-primary" />
          {t.newQuiz}
        </h2>
        <div className="grid gap-4 sm:grid-cols-5">
          <Link href="/study/new" className="sm:col-span-2">
            <Card className="group h-full transition-all hover:shadow-md hover:border-primary/40 hover:-translate-y-0.5 bg-primary/5">
              <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center h-full">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Layers className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold text-base">{t.buildCustom}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t.buildCustomHint}</p>
                </div>
                <Button size="sm" className="mt-1 gap-1.5">
                  <PlusCircle className="h-3.5 w-3.5" />
                  {t.start}
                </Button>
              </CardContent>
            </Card>
          </Link>
          <div className="sm:col-span-3 grid gap-2">
            {topChapters.map((c, i) => {
              const tone = usefulnessTone(c.learningUsefulnessIndex);
              return (
                <Link key={c.id} href={`/study/new?chapter=${c.number}`}>
                  <div className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-sm transition-all hover:shadow-sm hover:border-primary/30 hover:-translate-y-0.5">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_DOT_CLASS[tone]}`} />
                    <span className="font-mono text-xs text-muted-foreground w-8 shrink-0">{c.number}</span>
                    <span className="flex-1 font-medium line-clamp-1">{topChapterTitles[i].title}</span>
                    <Badge variant="secondary" className="shrink-0 text-xs">{c._count.questions}</Badge>
                    <Badge className={`shrink-0 text-xs ${TONE_BADGE_CLASS[tone]}`}>{toneLabel(tone, locale)}</Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent quizzes strip */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            {t.recentQuizzes}
          </h2>
          <Link href="/quizzes" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            {t.allQuizzes}
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
        </div>

        {recentCompleted.length === 0 && inProgress.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-sm text-muted-foreground space-y-3">
              <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground/40" />
              <p>{t.noQuizzes}</p>
              <Button asChild size="sm">
                <Link href="/study/new">{t.createFirst}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory">
            {recentCompleted.map((q) => {
              const p = progressMap.get(q.id)!;
              return (
                <Link key={q.id} href={`/quiz/${q.id}`} className="snap-start shrink-0">
                  <Card className="group w-44 transition-all hover:shadow-md hover:-translate-y-0.5">
                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">{q.name}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-success" />
                          {p.accuracyPct}%
                        </span>
                        <span>{q.createdAt.toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

