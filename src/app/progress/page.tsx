import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";
import { getExamPlanData } from "@/lib/exam-plan";
import { getUserProgress } from "@/lib/user-progress";
import { getActivityHeatmap, getCurrentStreak } from "@/lib/activity";
import { getHospitalActivity24h } from "@/lib/community-stats";
import { ProgressBarFull } from "@/components/progress/ProgressBarFull";
import { ActivityHeatmap } from "@/components/charts/ActivityHeatmap";
import { ExamPlanSection } from "./ExamPlanSection";
import { ChapterTable, type ChapterStatRow } from "./ChapterTable";
import { ScoreConfidenceOverview } from "./ScoreConfidenceOverview";
import { HospitalPieChart, type HospitalSlice } from "./HospitalPieChart";
import { CheckCircle2, TrendingUp, BookOpen, Flame } from "lucide-react";

export const dynamic = "force-dynamic";

const TOP_HOSPITALS = 8;

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.progressPage;
  const sp = await searchParams;
  const isAdmin = me.role === "ADMIN";

  const [plan, level, heatmap, attempts, hospitalRows] = await Promise.all([
    getExamPlanData(me),
    getUserProgress(me.id),
    getActivityHeatmap(me.id, 120),
    db.attempt.findMany({
      where: { userId: me.id },
      select: {
        isCorrect: true,
        question: { select: { chapter: { select: { number: true, title: true, learningUsefulnessIndex: true } } } },
      },
    }),
    isAdmin ? getHospitalActivity24h() : Promise.resolve([]),
  ]);

  // Overall accuracy and per-chapter breakdown across every attempt.
  const totalAttempts = attempts.length;
  const correctAttempts = attempts.filter((a) => a.isCorrect).length;
  const accuracy = totalAttempts === 0 ? 0 : Math.round((correctAttempts / totalAttempts) * 100);

  const byChapter = new Map<number, { title: string; total: number; correct: number; usefulness: number | null }>();
  for (const a of attempts) {
    const ch = a.question.chapter;
    const row = byChapter.get(ch.number) ?? { title: ch.title, total: 0, correct: 0, usefulness: ch.learningUsefulnessIndex };
    row.total++;
    if (a.isCorrect) row.correct++;
    byChapter.set(ch.number, row);
  }
  const chapterEntries = [...byChapter.entries()];
  const translatedTitles = await Promise.all(
    chapterEntries.map(([num, r]) => getTranslatedFields("Chapter", `n:${num}`, { title: r.title }, locale)),
  );
  const chapterRows: ChapterStatRow[] = chapterEntries.map(([num, r], i) => ({
    chapterNumber: num,
    title: translatedTitles[i].title,
    attempts: r.total,
    correct: r.correct,
    accuracy: Math.round((r.correct / r.total) * 100),
    usefulness: r.usefulness,
  }));

  const streak = getCurrentStreak(heatmap);
  const accuracyColor = totalAttempts === 0
    ? "text-muted-foreground"
    : accuracy >= 70 ? "text-success" : accuracy >= 50 ? "text-warning" : "text-destructive";

  // Admin-only: community activity by hospital (last 24h).
  let hospitalChartData: HospitalSlice[] = hospitalRows
    .map((r) => ({ name: r.hospitalName ?? dict.dashboard.hospitalChartNoHospital, value: r.solved }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  if (hospitalChartData.length > TOP_HOSPITALS) {
    const other = hospitalChartData.slice(TOP_HOSPITALS).reduce((s, d) => s + d.value, 0);
    hospitalChartData = [...hospitalChartData.slice(0, TOP_HOSPITALS), { name: dict.dashboard.hospitalChartOther, value: other }];
  }

  return (
    <div className="space-y-8 animate-fade-in sm:space-y-10">
      <div>
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      {level && <ProgressBarFull progress={level} t={dict.progress} />}

      {/* Overview */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label={t.uniqueAnswered}
          value={plan.uniqueAttempted.toLocaleString(locale)}
          hint={t.ofPool(plan.poolWithAnswer)}
          icon={CheckCircle2}
          colorClass="text-primary"
        />
        <StatCard
          label={t.accuracy}
          value={totalAttempts === 0 ? "—" : `${accuracy}%`}
          hint={t.accuracyHint}
          icon={TrendingUp}
          colorClass={accuracyColor}
        />
        <StatCard
          label={t.chapters}
          value={plan.chaptersCovered}
          hint={t.ofChapters(plan.chaptersTotal)}
          icon={BookOpen}
          colorClass="text-primary"
        />
        <StatCard
          label={t.streak}
          value={streak}
          hint={t.streakHint}
          icon={Flame}
          colorClass={streak > 0 ? "text-orange-500" : "text-muted-foreground"}
        />
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{t.activityTitle}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto pb-4" dir="ltr">
          {totalAttempts === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{dict.dashboard.noActivity}</p>
          ) : (
            <ActivityHeatmap data={heatmap} />
          )}
        </CardContent>
      </Card>

      {/* Exam plan */}
      <section id="plan" className="scroll-mt-20 space-y-3">
        <h2 className="font-display text-lg font-semibold">{t.planTitle}</h2>
        <ExamPlanSection plan={plan} locale={locale} />
      </section>

      {/* Chapters */}
      <section id="chapters" className="scroll-mt-20 space-y-3">
        <h2 className="font-display text-lg font-semibold">{dict.dashboard.byChapter}</h2>
        <ChapterTable rows={chapterRows} locale={locale} basePath="/progress" searchParams={sp} />
      </section>

      {/* Clinical scores */}
      <section className="space-y-3">
        <ScoreConfidenceOverview userId={me.id} locale={locale} />
      </section>

      {isAdmin && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{dict.dashboard.hospitalChartTitle}</CardTitle>
            <p className="text-xs text-muted-foreground">{dict.dashboard.hospitalChartSubtitle}</p>
          </CardHeader>
          <CardContent className="p-3 pt-0">
            {hospitalChartData.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{dict.dashboard.hospitalChartEmpty}</p>
            ) : (
              <HospitalPieChart data={hospitalChartData} questionsLabel={dict.dashboard.hospitalChartQuestions} />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  colorClass,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>{label}</span>
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </div>
        <p className={`font-display text-2xl font-bold tabular-nums sm:text-3xl ${colorClass}`}>{value}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}
