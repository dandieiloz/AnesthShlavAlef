"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Wand2 } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import type { ConfidenceLevel } from "@/lib/scores/types";
import { SCORE_SYSTEMS, scoresByCategory } from "@/lib/scores/registry";

type BadgeVariant = "success" | "warning" | "destructive" | "outline";

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

  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <div className="space-y-4" dir={dir}>
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
