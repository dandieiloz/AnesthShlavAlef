import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import type { GeneratedQuestion, ScoreSystem } from "@/lib/scores/types";

/**
 * Reveals how a generated score question was computed: the result line, a
 * component-by-component breakdown, any adjustment note, and the Miller
 * citation. Pure presentational; rendered inside the (client) runner.
 */
export function ScoreBreakdown({
  question,
  score,
  locale,
}: {
  question: GeneratedQuestion;
  score: ScoreSystem;
  locale: Locale;
}) {
  const t = getDictionary(locale).scores;
  const miller = score.miller;

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-3 text-sm">
      <p className="font-semibold text-foreground">{question.result[locale]}</p>

      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t.breakdownTitle}
        </p>
        <ul className="divide-y divide-border/60">
          {question.breakdown.map((row, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-1">
              <span className="text-muted-foreground">{row.label[locale]}</span>
              <span className="flex shrink-0 items-center gap-2 text-end">
                <span>{row.value[locale]}</span>
                {typeof row.points === "number" && (
                  <Badge variant="secondary" className="text-[10px]">
                    {row.points >= 0 ? `+${row.points}` : row.points} {t.pointsLabel}
                  </Badge>
                )}
              </span>
            </li>
          ))}
        </ul>
        {typeof question.total === "number" && (
          <div className="flex items-center justify-between border-t pt-1 font-medium">
            <span>{t.totalLabel}</span>
            <span>{question.total}</span>
          </div>
        )}
      </div>

      {question.note && (
        <p className="rounded-md border border-warning/40 bg-warning/10 px-2 py-1.5 text-xs text-foreground">
          {question.note[locale]}
        </p>
      )}

      <div className="text-xs text-muted-foreground">
        <span className="font-medium">{t.millerLabel}: </span>
        <span>{t.millerChapter(miller.primary.chapter, miller.primary.title[locale])}</span>
        {miller.also && miller.also.length > 0 && (
          <span>
            {" · "}
            {t.alsoSee}:{" "}
            {miller.also.map((m) => t.millerChapter(m.chapter, m.title[locale])).join(" · ")}
          </span>
        )}
      </div>
    </div>
  );
}
