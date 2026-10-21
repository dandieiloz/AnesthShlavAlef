import Link from "next/link";
import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLocale, getContentLocale, type Locale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getQuizRows } from "@/lib/quiz-rows";
import { getExamPlanData } from "@/lib/exam-plan";
import { getMyQuestionCounts } from "@/lib/my-questions";
import { getActivityHeatmap, getCurrentStreak } from "@/lib/activity";
import { getHospitalActivity24h, summarizeCommunity } from "@/lib/community-stats";
import { ForumPreview } from "@/app/forum/ForumPreview";
import { ContinueQuizCard, PracticeList } from "@/components/quizzes/PracticeList";
import { PlusCircle, RotateCcw, Bookmark, Calculator, Flame, CalendarClock, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserProgress } from "@/lib/user-progress";
import { LEVEL_ICONS } from "@/lib/progress-level";

const RECENT_COUNT = 4;

function residencyLabel(year: number | null, t: { yearLabels: Record<number, string>; yearLabel: (n: number) => string }): string {
  if (!year) return "";
  return t.yearLabels[year] ?? t.yearLabel(year);
}

export default async function HomePage() {
  const me = await requireCompletedProfile();
  const [locale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const dict = getDictionary(locale);
  const t = dict.homePage;
  const tStudy = dict.study;

  const [dbUser, quizData, plan, counts, heatmap, hospitalRows, level] = await Promise.all([
    db.user.findUnique({ where: { id: me.id }, select: { residencyYear: true } }),
    getQuizRows(me),
    getExamPlanData(me),
    getMyQuestionCounts(me, contentLocale),
    getActivityHeatmap(me.id, 120),
    getHospitalActivity24h(),
    getUserProgress(me.id),
  ]);

  const { rows: quizRows, totalCount } = quizData;
  // The quiz to pick up next: the most recently active one that isn't finished.
  const nextQuiz = quizRows.find((q) => !q.isComplete) ?? null;
  const recent = quizRows.filter((q) => q.id !== nextQuiz?.id).slice(0, RECENT_COUNT);

  const streak = getCurrentStreak(heatmap);
  const answeredToday = heatmap.at(-1)?.count ?? 0;
  const community = summarizeCommunity(hospitalRows);
  const Chevron = locale === "he" ? ChevronLeft : ChevronRight;
  const LevelIcon = level ? LEVEL_ICONS[level.level.key] : Sparkles;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Greeting + main action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h1 className="font-display text-2xl font-bold">
            {me.name ? tStudy.greeting(me.name.split(" ")[0]) : tStudy.greetingAnon}
          </h1>
          {dbUser?.residencyYear && (
            <Badge variant="secondary" className="px-2.5 py-0.5 text-xs">
              {residencyLabel(dbUser.residencyYear, tStudy)}
            </Badge>
          )}
          {level && (
            <Link
              href="/progress#progress"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90",
                level.level.gradient,
              )}
              title={dict.progress.levelOfTotal(level.index + 1, 5)}
            >
              <LevelIcon className="h-3 w-3" />
              {dict.progress.levels[level.level.key].title}
            </Link>
          )}
        </div>
        <Button asChild size="lg" className="gap-2">
          <Link href="/study/new">
            <PlusCircle className="h-4 w-4" />
            {t.newQuiz}
          </Link>
        </Button>
      </div>

      {/* Hero: next quiz + today */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {nextQuiz ? (
            <ContinueQuizCard
              q={nextQuiz}
              locale={locale}
              title={nextQuiz.answered > 0 ? t.continueTitle : t.startTitle}
            />
          ) : (
            <Card className="h-full border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
              <CardContent className="flex h-full flex-col items-start gap-3 p-5">
                <Sparkles className="h-6 w-6 text-primary" />
                <p className="font-display text-lg font-bold">{t.welcomeTitle}</p>
                <p className="text-sm text-muted-foreground">{t.welcomeBody}</p>
                <Button asChild className="mt-auto gap-1.5">
                  <Link href="/study/new">
                    <PlusCircle className="h-4 w-4" />
                    {totalCount === 0 ? t.welcomeCta : t.newQuiz}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        <TodayCard
          locale={locale}
          answeredToday={answeredToday}
          dailyTarget={plan.result?.questionsPerDay ?? null}
          daysLeft={plan.result?.daysLeft ?? null}
          streak={streak}
        />
      </div>

      {/* Shortcuts */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Shortcut
          href="/my-questions?tab=wrong"
          icon={RotateCcw}
          iconClass="bg-destructive/10 text-destructive"
          title={t.quickMistakes}
          hint={t.quickMistakesHint(counts.wrong)}
          chevron={Chevron}
        />
        <Shortcut
          href="/my-questions?tab=saved"
          icon={Bookmark}
          iconClass="bg-amber-500/10 text-amber-500"
          title={t.quickSaved}
          hint={t.quickSavedHint(counts.saved)}
          chevron={Chevron}
        />
        <Shortcut
          href="/study/new?mode=scores"
          icon={Calculator}
          iconClass="bg-primary/10 text-primary"
          title={t.quickScores}
          hint={t.quickScoresHint}
          chevron={Chevron}
        />
      </div>

      {/* Recent practice */}
      {recent.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-semibold">{t.recentTitle}</h2>
            <Link href="/quizzes" className="text-sm font-medium text-primary hover:underline">
              {t.allQuizzes(totalCount)}
            </Link>
          </div>
          <PracticeList quizzes={recent} locale={locale} />
        </section>
      )}

      {/* Community */}
      <section className="space-y-4">
        <CommunityLine locale={locale} summary={community} emptyText={dict.dashboard.hospitalSummaryEmpty} />
        <ForumPreview locale={locale} />
      </section>
    </div>
  );
}

function TodayCard({
  locale,
  answeredToday,
  dailyTarget,
  daysLeft,
  streak,
}: {
  locale: Locale;
  answeredToday: number;
  dailyTarget: number | null;
  daysLeft: number | null;
  streak: number;
}) {
  const t = getDictionary(locale).homePage;
  const pct = dailyTarget ? Math.min(100, Math.round((answeredToday / dailyTarget) * 100)) : 0;
  const done = dailyTarget !== null && answeredToday >= dailyTarget;
  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <p className="text-xs font-medium text-muted-foreground">{t.todayTitle}</p>
        <div>
          <p className="font-display text-3xl font-bold tabular-nums">
            {answeredToday}
            {dailyTarget !== null && (
              <span className="text-lg font-medium text-muted-foreground"> / {dailyTarget}</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">
            {dailyTarget !== null ? (done ? t.todayDone : t.todayOfTarget(dailyTarget)) : t.todayAnswered}
          </p>
          {dailyTarget !== null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all", done ? "bg-success" : "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
        </div>
        <div className="mt-auto space-y-1.5 text-sm">
          <p className="flex items-center gap-2">
            <Flame className={cn("h-4 w-4", streak > 0 ? "text-orange-500" : "text-muted-foreground")} />
            {t.streak(streak)}
          </p>
          {daysLeft !== null ? (
            <p className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-primary" />
              {t.daysToExam(daysLeft)}
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">{t.todayNoPlan}</p>
              <Link href="/progress#plan" className="text-xs font-medium text-primary hover:underline">
                {t.setPlanCta}
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Shortcut({
  href,
  icon: Icon,
  iconClass,
  title,
  hint,
  chevron: Chevron,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  iconClass: string;
  title: string;
  hint: string;
  chevron: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full transition-colors group-hover:border-primary/40 group-hover:bg-muted/30">
        <CardContent className="flex items-center gap-3 p-4">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", iconClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{title}</p>
            <p className="line-clamp-2 text-xs text-muted-foreground">{hint}</p>
          </div>
          <Chevron className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 rtl:group-hover:translate-x-0.5" />
        </CardContent>
      </Card>
    </Link>
  );
}

function CommunityLine({
  locale,
  summary,
  emptyText,
}: {
  locale: Locale;
  summary: { solved: number; residents: number; hospitals: number };
  emptyText: string;
}) {
  const num = (v: number, cls: string) => (
    <span className={cn("font-display font-bold", cls)}>{v.toLocaleString(locale)}</span>
  );
  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent px-4 py-3">
      {summary.solved === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <p className="text-center text-sm font-medium leading-relaxed" dir={locale === "he" ? "rtl" : "ltr"}>
          {locale === "he" ? "נפתרו " : "In the last 24 hours, "}
          {num(summary.solved, "text-primary")}
          {locale === "he" ? " שאלות על ידי " : " questions were solved by "}
          {num(summary.residents, "text-success")}
          {locale === "he" ? " מתמחים מ-" : " residents from "}
          {num(summary.hospitals, "text-orange-500")}
          {locale === "he" ? " בתי חולים ב-24 השעות האחרונות" : " hospitals"}
        </p>
      )}
    </div>
  );
}
