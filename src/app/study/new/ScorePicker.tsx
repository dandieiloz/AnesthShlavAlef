"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Wand2, History } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import type { ConfidenceLevel } from "@/lib/scores/types";
import { SCORE_SYSTEMS, scoresByCategory } from "@/lib/scores/registry";

type BadgeVariant = "success" | "warning" | "destructive" | "outline";

/** localStorage key holding the user's last picker selection (scores + count). */
const LAST_CONFIG_KEY = "score-drill:last-config";
/** Prefix the drill runner uses for its per-exam sessionStorage snapshots. */
const DRILL_PREFIX = "score-drill:";

type ResumableDrill = { ids: string[]; count: number; step: number };

/**
 * Scan sessionStorage for the most recently-updated in-progress score drill so
 * the picker can offer to continue it. Keys are `score-drill:<sortedIds>:<count>`
 * and the value carries step/finished/updatedAt. Returns null when nothing is
 * resumable (no entry, all finished, or storage unavailable).
 */
function findResumableDrill(validIds: Set<string>): ResumableDrill | null {
  let best: { drill: ResumableDrill; updatedAt: number } | null = null;
  try {
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(DRILL_PREFIX) || key === LAST_CONFIG_KEY) continue;
      const rest = key.slice(DRILL_PREFIX.length);
      const lastColon = rest.lastIndexOf(":");
      if (lastColon <= 0) continue;
      const ids = rest
        .slice(0, lastColon)
        .split(",")
        .filter((id) => validIds.has(id));
      const count = Number(rest.slice(lastColon + 1));
      if (ids.length === 0 || !Number.isFinite(count)) continue;

      const raw = sessionStorage.getItem(key);
      if (!raw) continue;
      const saved = JSON.parse(raw) as {
        step?: unknown;
        revealed?: unknown;
        finished?: unknown;
        updatedAt?: unknown;
      };
      const step = Number(saved.step);
      if (saved.finished || !Number.isFinite(step) || step >= count) continue;
      // Only offer to resume once the user has actually made progress.
      if (step <= 0 && saved.revealed !== true) continue;

      const updatedAt = Number(saved.updatedAt) || 0;
      if (!best || updatedAt > best.updatedAt) {
        best = { drill: { ids, count, step }, updatedAt };
      }
    }
  } catch {
    return null;
  }
  return best?.drill ?? null;
}

function confidenceBadge(
  level: ConfidenceLevel | undefined,
  t: ReturnType<typeof getDictionary>["scores"],
): { variant: BadgeVariant; label: string } {
  switch (level) {
    case "CONFIDENT":
      return { variant: "success", label: t.confident };
    case "OK":
      return { variant: "warning", label: t.ok };
    case "WEAK":
      return { variant: "destructive", label: t.weak };
    default:
      return { variant: "outline", label: t.unrated };
  }
}

export function ScorePicker({
  locale,
  confidence,
}: {
  locale: Locale;
  confidence: Record<string, ConfidenceLevel>;
}) {
  const t = getDictionary(locale).scores;
  const router = useRouter();
  const groups = useMemo(() => scoresByCategory(), []);
  const allIds = useMemo(() => SCORE_SYSTEMS.map((s) => s.id), []);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(allIds));
  const [count, setCount] = useState(10);
  const [hydrated, setHydrated] = useState(false);
  const [resume, setResume] = useState<ResumableDrill | null>(null);

  // Restore the last selection the user made and detect an unfinished drill so
  // they can continue where they left off. Client-only (storage is unavailable
  // during SSR).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_CONFIG_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { ids?: unknown; count?: unknown };
        const validSet = new Set(allIds);
        const ids = Array.isArray(saved.ids)
          ? saved.ids.filter((id): id is string => typeof id === "string" && validSet.has(id))
          : [];
        if (ids.length > 0) setSelected(new Set(ids));
        const c = Number(saved.count);
        if (Number.isFinite(c)) setCount(Math.min(50, Math.max(1, Math.round(c))));
      }
    } catch {
      // Ignore corrupt/unavailable storage — keep defaults.
    }
    setResume(findResumableDrill(new Set(allIds)));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist the selection whenever it changes so the next visit reopens here.
  useEffect(() => {
    if (!hydrated) return;
    try {
      const ids = allIds.filter((id) => selected.has(id));
      localStorage.setItem(LAST_CONFIG_KEY, JSON.stringify({ ids, count }));
    } catch {
      // Best-effort persistence.
    }
  }, [hydrated, selected, count, allIds]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(allIds));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function selectWeak() {
    setSelected(
      new Set(allIds.filter((id) => confidence[id] === "WEAK" || confidence[id] === undefined)),
    );
  }

  function start() {
    if (selected.size === 0) return;
    const ids = allIds.filter((id) => selected.has(id));
    const params = new URLSearchParams({ scores: ids.join(","), count: String(count) });
    router.push(`/study/scores?${params.toString()}`);
  }

  function continueDrill() {
    if (!resume) return;
    const params = new URLSearchParams({
      scores: resume.ids.join(","),
      count: String(resume.count),
    });
    router.push(`/study/scores?${params.toString()}`);
  }

  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <div className="space-y-4" dir={dir}>
      {resume && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t.resumeTitle}</p>
            <p className="text-xs text-muted-foreground">
              {t.resumeProgress(resume.step + 1, resume.count)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={continueDrill} className="gap-1.5">
              <History className="h-3.5 w-3.5" />
              {t.resumeDrill}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setResume(null)}
            >
              {t.dismissResume}
            </Button>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>{t.chooseScores}</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectWeak} className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            {t.practiceWeak}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
            {t.selectAll}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearAll}>
            {t.clearAll}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t.practiceWeakHint}</p>

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.category.id} className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.category.label[locale]}
            </h4>
            <div className="space-y-1">
              {group.scores.map((score) => {
                const badge = confidenceBadge(confidence[score.id], t);
                const checked = selected.has(score.id);
                return (
                  <label
                    key={score.id}
                    className="flex cursor-pointer items-start gap-2.5 rounded-md border border-transparent px-2 py-1.5 hover:border-input hover:bg-muted/40"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(score.id)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-input accent-primary"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{score.abbrev}</span>
                        <Badge variant={badge.variant} className="text-[10px]">
                          {badge.label}
                        </Badge>
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {score.name[locale]}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="score-count">{t.scoreCount}</Label>
        <input
          id="score-count"
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n)) setCount(Math.min(50, Math.max(1, Math.round(n))));
          }}
          className="w-24 rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <Button
        type="button"
        className="w-full gap-2"
        size="lg"
        onClick={start}
        disabled={selected.size === 0}
      >
        <Play className="h-4 w-4" />
        {selected.size === 0 ? t.noScoresSelected : t.startDrill}
      </Button>
    </div>
  );
}
