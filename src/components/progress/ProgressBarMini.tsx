import Link from "next/link";
import { LEVEL_ICONS, type LevelComputation, type LevelKey } from "@/lib/progress-level";
import type { Dictionary } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Plain serializable view-model — safe to send across the RSC boundary. */
export interface ProgressMiniViewModel {
  levelKey: LevelKey;
  gradient: string;
  title: string;
  levelProgressPct: number;
  tooltip: string;
  ariaLabel: string;
}

interface ProgressBarMiniProps {
  vm: ProgressMiniViewModel;
  className?: string;
}

/**
 * Compact career-progress pill. Hidden on small screens (use the full bar in /profile instead).
 */
export function ProgressBarMini({ vm, className }: ProgressBarMiniProps) {
  const Icon = LEVEL_ICONS[vm.levelKey];
  return (
    <Link
      href="/profile#progress"
      title={vm.tooltip}
      aria-label={vm.ariaLabel}
      className={cn(
        "group hidden md:flex items-center gap-2 rounded-full border bg-card/60 px-2.5 py-1 transition-colors hover:bg-card",
        className,
      )}
    >
      <span className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white shadow-sm",
        vm.gradient,
      )}>
        <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      </span>
      <span className="flex flex-col gap-0.5 min-w-[88px]">
        <span className="text-[11px] font-medium leading-none text-foreground/90 truncate">
          {vm.title}
        </span>
        <span className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <span
            className={cn(
              "absolute inset-y-0 start-0 rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out",
              vm.gradient,
            )}
            style={{ width: `${vm.levelProgressPct}%` }}
          />
        </span>
      </span>
    </Link>
  );
}

/** Build the view-model from raw progress + dict in a server context. */
export function buildProgressMiniViewModel(
  progress: LevelComputation,
  t: Dictionary["progress"],
): ProgressMiniViewModel {
  const levelStrings = t.levels[progress.level.key];
  const nextStrings = progress.nextLevel ? t.levels[progress.nextLevel.key] : null;
  const lines = [
    `${levelStrings.title} \u00b7 ${t.levelOfTotal(progress.index + 1, 5)}`,
    t.solvedOfTotal(progress.solved, progress.total),
    nextStrings ? t.toNext(progress.toNext, nextStrings.title) : t.maxedOut,
  ];
  return {
    levelKey: progress.level.key,
    gradient: progress.level.gradient,
    title: levelStrings.title,
    levelProgressPct: progress.levelProgressPct,
    tooltip: lines.join("\n"),
    ariaLabel: t.ariaLabel(levelStrings.title, progress.levelProgressPct),
  };
}
