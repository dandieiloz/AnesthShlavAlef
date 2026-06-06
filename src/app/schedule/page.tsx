import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  Target,
  CheckCircle2,
  CircleDashed,
  Database,
  Gauge,
  Flag,
  BookOpen,
  Activity,
  TrendingUp,
} from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { computeSchedule, type PaceStatus } from "@/lib/schedule";
import { saveScheduleAction } from "./actions";
import { questionAccessWhere, hasUsableAnswerWhere } from "@/lib/plan";

export const dynamic = "force-dynamic";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export default async function SchedulePage() {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.schedule;

  const cutoff14 = new Date(Date.now() - 14 * MS_PER_DAY);
  const planGate = await questionAccessWhere(me);

  const [user, poolWithAnswer, totalInDb, attempts, recent14, chaptersTotal] =
    await Promise.all([
      db.user.findUnique({
        where: { id: me.id },
        select: { examDate: true, questionsPerWeek: true },
      }),
      db.question.count({ where: { AND: [planGate, hasUsableAnswerWhere] } }),
      db.question.count({ where: { AND: [planGate] } }),
      db.attempt.findMany({
        where: { userId: me.id },
        select: { questionId: true },
        distinct: ["questionId"],
      }),
      db.attempt.findMany({
        where: { userId: me.id, createdAt: { gte: cutoff14 } },
        select: { createdAt: true },
      }),
      db.chapter.count(),
    ]);

  const uniqueAttempted = attempts.length;
  const notAttempted = Math.max(0, poolWithAnswer - uniqueAttempted);

  let chaptersCovered = 0;
  if (attempts.length > 0) {
    const attemptedIds = attempts.map((a) => a.questionId);
    const rows = await db.question.findMany({
      where: { id: { in: attemptedIds } },
      select: { chapterId: true },
      distinct: ["chapterId"],
    });
    chaptersCovered = rows.length;
  }

  const hasPlan = !!user?.examDate && !!user?.questionsPerWeek;

  const result = hasPlan
    ? computeSchedule({
        examDate: user!.examDate!,
        questionsPerWeek: user!.questionsPerWeek!,
        poolWithAnswer,
        uniqueAttempted,
        recentAttempts14d: recent14.map((r) => r.createdAt),
        chaptersTotal,
        chaptersCovered,
      })
    : null;

  const examDateValue = user?.examDate
    ? user.examDate.toISOString().slice(0, 10)
    : "";
  const qpwValue = user?.questionsPerWeek ?? "";

  return (
    <div className="mx-auto max-w-5xl space-y-8 py-10 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <CalendarClock className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.planTitle}</CardTitle>
          <CardDescription>{t.planDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveScheduleAction} className="grid gap-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="examDate">{t.examDateLabel}</Label>
              <Input id="examDate" name="examDate" type="date" required defaultValue={examDateValue} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="questionsPerWeek">{t.qPerWeekLabel}</Label>
              <Input
                id="questionsPerWeek"
                name="questionsPerWeek"
                type="number"
                min={1}
                max={500}
                required
                defaultValue={qpwValue}
                placeholder={t.qPerWeekPlaceholder}
              />
            </div>
            <Button type="submit">{t.save}</Button>
          </form>
        </CardContent>
      </Card>

      {/* Pool counters */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label={t.answeredLabel} value={uniqueAttempted} icon={CheckCircle2} colorClass="text-success" />
        <StatCard label={t.notAttemptedLabel} value={notAttempted} icon={CircleDashed} />
        <StatCard label={t.totalLabel} value={totalInDb} icon={Database} colorClass="text-muted-foreground" />
      </div>

      {!hasPlan ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">
            {t.emptyHint}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ───── PLAN (target) ───── */}
          <section className="rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5 space-y-4">
            <SectionHeader
              tone="plan"
              icon={Target}
              title={t.planSectionTitle}
              subtitle={t.planSectionSubtitle}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <PlanTile label={t.daysLeftLabel} value={result!.daysLeft} icon={CalendarDays} />
              <PlanTile label={t.weeksLeftLabel} value={result!.weeksLeft} icon={CalendarRange} />
              <PlanTile label={t.qPerWeekTargetLabel} value={user!.questionsPerWeek!} icon={Target} />
              <PlanTile label={t.qPerDayTargetLabel} value={result!.questionsPerDay} icon={Target} />
            </div>
            <div className="rounded-lg border border-primary/20 bg-card/60 p-3 text-sm">
              <p className="text-muted-foreground">{t.remainingLabel}</p>
              <p className="font-display text-xl font-bold text-primary">
                {result!.remaining}
                <span className="ms-1 text-sm font-normal text-muted-foreground">/ {poolWithAnswer}</span>
              </p>
            </div>
          </section>

          {/* ───── CURRENT PACE (actuals) ───── */}
          <section className={`rounded-xl border-2 p-5 space-y-4 ${paceSectionClass(result!.paceStatus)}`}>
            <SectionHeader
              tone="pace"
              icon={Activity}
              title={t.paceSectionTitle}
              subtitle={t.paceSectionSubtitle}
              accessory={
                <Badge className={paceBadgeClass(result!.paceStatus)}>
                  {t.paceStatus[result!.paceStatus]}
                </Badge>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <PaceTile
                label={t.actualQPerDayLabel}
                value={result!.recentAvgPerDay}
                target={result!.requiredPerDay}
                icon={Gauge}
                status={result!.paceStatus}
                vsTarget={t.vsTarget}
              />
              <PaceTile
                label={t.actualQPerWeekLabel}
                value={result!.recentAvgPerWeek}
                target={user!.questionsPerWeek!}
                icon={TrendingUp}
                status={result!.paceStatus}
                vsTarget={t.vsTarget}
              />
            </div>
            <div className="rounded-lg border border-current/20 bg-card/60 p-3 text-sm">
              <p className="text-muted-foreground">{t.projectedFinishLabel}</p>
              {result!.projectedFinishDate ? (
                <div className="mt-0.5 flex items-baseline gap-2">
                  <p className="font-display text-xl font-bold">
                    {formatDate(result!.projectedFinishDate, locale)}
                  </p>
                  {result!.projectedFinishDays !== null && (
                    <p className="text-xs text-muted-foreground">
                      ({t.inDays(result!.projectedFinishDays)})
                    </p>
                  )}
                </div>
              ) : (
                <p className="font-display text-xl font-bold text-muted-foreground">—</p>
              )}
              {result!.paceStatus !== "notStarted" && (
                <p className="mt-2 text-xs">
                  <Flag className="me-1 inline h-3 w-3" />
                  {result!.paceDelta >= 0
                    ? t.paceAheadBy(result!.paceDelta)
                    : t.paceBehindBy(Math.abs(result!.paceDelta))}
                </p>
              )}
            </div>
          </section>

          {/* Chapter coverage spans full width */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
                {t.chapterCoverageLabel}
                <BookOpen className="h-4 w-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <p className="font-display text-2xl font-bold">
                  {result!.chaptersCovered}
                  <span className="text-muted-foreground"> / {chaptersTotal}</span>
                </p>
                <div className="flex-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${chaptersTotal === 0 ? 0 : Math.round((result!.chaptersCovered / chaptersTotal) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.chaptersRemainingSuffix(result!.chaptersRemaining)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function SectionHeader({
  tone,
  icon: Icon,
  title,
  subtitle,
  accessory,
}: {
  tone: "plan" | "pace";
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  accessory?: React.ReactNode;
}) {
  const iconBg = tone === "plan" ? "bg-primary/15 text-primary" : "bg-card text-foreground";
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {accessory}
    </div>
  );
}

function PlanTile({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-primary/20 bg-card/60 p-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <Icon className="h-3.5 w-3.5 text-primary/70" />
      </div>
      <p className="mt-1 font-display text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}

function PaceTile({
  label,
  value,
  target,
  icon: Icon,
  status,
  vsTarget,
}: {
  label: string;
  value: number;
  target: number;
  icon: React.ComponentType<{ className?: string }>;
  status: PaceStatus;
  vsTarget: (target: number | string) => string;
}) {
  const color = paceTextClass(status);
  return (
    <div className="rounded-lg border border-current/20 bg-card/60 p-3">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span>{label}</span>
        <Icon className={`h-3.5 w-3.5 ${color}`} />
      </div>
      <p className={`mt-1 font-display text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{vsTarget(target)}</p>
    </div>
  );
}

function paceSectionClass(status: PaceStatus): string {
  switch (status) {
    case "ahead":
      return "border-success/40 bg-success/5 text-success";
    case "onTrack":
      return "border-primary/30 bg-primary/5 text-primary";
    case "behind":
      return "border-destructive/40 bg-destructive/5 text-destructive";
    case "notStarted":
    default:
      return "border-muted-foreground/20 bg-muted/30 text-muted-foreground";
  }
}

function paceTextClass(status: PaceStatus): string {
  switch (status) {
    case "ahead":
      return "text-success";
    case "onTrack":
      return "text-primary";
    case "behind":
      return "text-destructive";
    case "notStarted":
    default:
      return "text-muted-foreground";
  }
}

function paceBadgeClass(status: PaceStatus): string {
  switch (status) {
    case "ahead":
      return "bg-success/15 text-success border-success/30";
    case "onTrack":
      return "bg-primary/15 text-primary border-primary/30";
    case "behind":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "notStarted":
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/20";
  }
}

function StatCard({
  label,
  value,
  icon: Icon,
  colorClass = "text-primary",
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  colorClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium text-muted-foreground">
          {label}
          <Icon className={`h-4 w-4 ${colorClass}`} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`font-display text-3xl font-bold ${colorClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(d: Date, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale === "he" ? "he-IL" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}
