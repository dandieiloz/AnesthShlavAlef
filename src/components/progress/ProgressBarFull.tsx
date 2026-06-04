import { Card, CardContent } from "@/components/ui/card";
import { Lock, Check } from "lucide-react";
import { LEVELS, LEVEL_ICONS, type LevelComputation } from "@/lib/progress-level";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ProgressBarFullProps {
  progress: LevelComputation;
  t: Dictionary["progress"];
}

/**
 * Hero progress card for the profile page. Shows the current rank, overall bar,
 * the five milestones with locked/unlocked state, and the "next rank" CTA.
 */
export function ProgressBarFull({ progress, t }: ProgressBarFullProps) {
  const { level, nextLevel, levelProgressPct, overallPct, solved, total, toNext, index } = progress;
  const Icon = LEVEL_ICONS[level.key];
  const levelStrings = t.levels[level.key];
  const nextStrings = nextLevel ? t.levels[nextLevel.key] : null;

  return (
    <Card id="progress" className="overflow-hidden border-0 shadow-sm ring-1 ring-border">
      <div className={cn("h-1 w-full bg-gradient-to-r", level.gradient)} />
      <CardContent className="space-y-4 p-4 sm:p-5">
        {/* Header row: icon + titles */}
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
              level.gradient,
            )}
          >
            <Icon className="h-6 w-6" strokeWidth={2.25} />
            <span className="absolute -bottom-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-card px-1 text-[10px] font-bold text-foreground ring-2 ring-card shadow">
              {index + 1}/5
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
              {t.heading}
            </p>
            <h3 className="font-display text-lg font-bold leading-tight truncate">
              {levelStrings.title}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {levelStrings.flavor}
            </p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs text-muted-foreground">
            <span>{t.solvedOfTotal(solved, total)}</span>
            <span className="tabular-nums font-semibold text-foreground">{overallPct}%</span>
          </div>
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-out",
                level.gradient,
              )}
              style={{ width: `${overallPct}%` }}
            />
            {/* Tier divider ticks */}
            {[20, 40, 60, 80].map((pos) => (
              <span
                key={pos}
                className="absolute inset-y-0 w-px bg-card/80"
                style={{ insetInlineStart: `${pos}%` }}
                aria-hidden
              />
            ))}
          </div>
          {nextStrings ? (
            <p className="text-xs">
              <span className="font-semibold text-foreground">{t.toNext(toNext, nextStrings.title)}</span>
            </p>
          ) : (
            <p className="text-xs font-semibold text-foreground">{t.maxedOut}</p>
          )}
        </div>

        {/* Milestone strip */}
        <ol className="grid grid-cols-5 gap-1.5">
            {LEVELS.map((lvl, i) => {
              const LvlIcon = LEVEL_ICONS[lvl.key];
              const isCurrent = i === index;
              const isUnlocked = i <= index;
              const strings = t.levels[lvl.key];
              return (
                <li
                  key={lvl.key}
                  className={cn(
                    "relative flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-colors",
                    isCurrent
                      ? "border-transparent bg-gradient-to-br text-white shadow-md " + lvl.gradient
                      : isUnlocked
                        ? "border-border bg-card"
                        : "border-dashed border-border/60 bg-muted/30",
                  )}
                  aria-current={isCurrent ? "step" : undefined}
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full",
                      isCurrent
                        ? "bg-white/20 text-white"
                        : isUnlocked
                          ? cn("bg-gradient-to-br text-white", lvl.gradient)
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {!isUnlocked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <LvlIcon className="h-3.5 w-3.5" strokeWidth={2.25} />
                    )}
                  </span>
                  <span className={cn(
                    "text-[10px] font-semibold leading-tight line-clamp-2",
                    isCurrent ? "text-white" : isUnlocked ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {strings.title}
                  </span>
                  {isUnlocked && !isCurrent && (
                    <Check className="absolute end-0.5 top-0.5 h-2.5 w-2.5 text-emerald-500" aria-label={t.unlocked} />
                  )}
                </li>
              );
            })}
          </ol>
      </CardContent>
    </Card>
  );
}
