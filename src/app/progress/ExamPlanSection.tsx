import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, CalendarRange, Target, Gauge, Flag, Activity, TrendingUp } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import type { PaceStatus } from "@/lib/schedule";
import type { ExamPlanData } from "@/lib/exam-plan";
import { saveScheduleAction } from "./actions";

/** Exam-date + weekly-target form, followed by the target vs. actual pace. */
export function ExamPlanSection({ plan, locale }: { plan: ExamPlanData; locale: Locale }) {
  const t = getDictionary(locale).schedule;
  const result = plan.result;
  const examDateValue = plan.examDate ? plan.examDate.toISOString().slice(0, 10) : "";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t.planTitle}</CardTitle>
          <CardDescription>{t.planDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveScheduleAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
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
                defaultValue={plan.questionsPerWeek ?? ""}
                placeholder={t.qPerWeekPlaceholder}
              />
            </div>
            <Button type="submit">{t.save}</Button>
          </form>
        </CardContent>
      </Card>

      {!result ? (
        <Card>
          <CardContent className="pt-6 text-center text-sm text-muted-foreground">{t.emptyHint}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 p-5">
            <SectionHeader tone="plan" icon={Target} title={t.planSectionTitle} subtitle={t.planSectionSubtitle} />
            <div className="grid grid-cols-2 gap-3">
              <PlanTile label={t.daysLeftLabel} value={result.daysLeft} icon={CalendarDays} />
              <PlanTile label={t.weeksLeftLabel} value={result.weeksLeft} icon={CalendarRange} />
              <PlanTile label={t.qPerWeekTargetLabel} value={plan.questionsPerWeek!} icon={Target} />
              <PlanTile label={t.qPerDayTargetLabel} value={result.questionsPerDay} icon={Target} />
            </div>
            <div className="rounded-lg border border-primary/20 bg-card/60 p-3 text-sm">
              <p className="text-muted-foreground">{t.remainingLabel}</p>
              <p className="font-display text-xl font-bold text-primary">
                {result.remaining}
                <span className="ms-1 text-sm font-normal text-muted-foreground">/ {plan.poolWithAnswer}</span>
              </p>
            </div>
          </section>

          <section className={`space-y-4 rounded-xl border-2 p-5 ${paceSectionClass(result.paceStatus)}`}>
            <SectionHeader
              tone="pace"
              icon={Activity}
              title={t.paceSectionTitle}
              subtitle={t.paceSectionSubtitle}
              accessory={<Badge className={paceBadgeClass(result.paceStatus)}>{t.paceStatus[result.paceStatus]}</Badge>}
            />
            <div className="grid grid-cols-2 gap-3">
              <PaceTile
                label={t.actualQPerDayLabel}
                value={result.recentAvgPerDay}
                target={result.requiredPerDay}
                icon={Gauge}
                status={result.paceStatus}
                vsTarget={t.vsTarget}
              />
              <PaceTile
                label={t.actualQPerWeekLabel}
                value={result.recentAvgPerWeek}
                target={plan.questionsPerWeek!}
                icon={TrendingUp}
                status={result.paceStatus}
                vsTarget={t.vsTarget}
              />
            </div>
            <div className="rounded-lg border border-current/20 bg-card/60 p-3 text-sm">
              <p className="text-muted-foreground">{t.projectedFinishLabel}</p>
              {result.projectedFinishDate ? (
                <div className="mt-0.5 flex items-baseline gap-2">
                  <p className="font-display text-xl font-bold">{formatDate(result.projectedFinishDate, locale)}</p>
                  {result.projectedFinishDays !== null && (
                    <p className="text-xs text-muted-foreground">({t.inDays(result.projectedFinishDays)})</p>
                  )}
                </div>
              ) : (
                <p className="font-display text-xl font-bold text-muted-foreground">—</p>
              )}
              {result.paceStatus !== "notStarted" && (
                <p className="mt-2 text-xs">
                  <Flag className="me-1 inline h-3 w-3" />
                  {result.paceDelta >= 0 ? t.paceAheadBy(result.paceDelta) : t.paceBehindBy(Math.abs(result.paceDelta))}
                </p>
              )}
            </div>
          </section>
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
          <h3 className="font-display text-base font-semibold leading-tight">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {accessory}
    </div>
  );
}

function PlanTile({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="rounded-lg border border-primary/20 bg-card/60 p-3">
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
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
      <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
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
    default:
      return "bg-muted text-muted-foreground border-muted-foreground/20";
  }
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
