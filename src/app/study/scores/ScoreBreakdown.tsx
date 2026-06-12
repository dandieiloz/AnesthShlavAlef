import { Badge } from "@/components/ui/badge";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { findBand } from "@/lib/scores/engine";
import type { GeneratedQuestion, ScoreSystem } from "@/lib/scores/types";

import { cn } from "@/lib/utils";

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

      <FullExplanation question={question} score={score} locale={locale} t={t} />

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

type ScoresDict = ReturnType<typeof getDictionary>["scores"];

/**
 * The complete reference for the score, regardless of the specific generated
 * question: a one-line description plus the full interpretation scale (bands /
 * categories / code positions), highlighting the part that applied this time.
 */
function FullExplanation({
  question,
  score,
  locale,
  t,
}: {
  question: GeneratedQuestion;
  score: ScoreSystem;
  locale: Locale;
  t: ScoresDict;
}) {
  return (
    <div className="space-y-2 border-t pt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t.aboutTitle}
      </p>
      <p className="text-xs text-muted-foreground">{score.blurb[locale]}</p>

      {score.kind === "additive" && (
        <AdditiveScale
          score={score}
          total={question.total}
          breakdown={question.breakdown}
          locale={locale}
          t={t}
        />
      )}
      {score.kind === "classify" && (
        <ClassifyScale score={score} question={question} locale={locale} t={t} />
      )}
      {score.kind === "decode" && <DecodeScale score={score} locale={locale} t={t} />}
    </div>
  );
}

function AdditiveScale({
  score,
  total,
  breakdown,
  locale,
  t,
}: {
  score: Extract<ScoreSystem, { kind: "additive" }>;
  total: number | undefined;
  breakdown: GeneratedQuestion["breakdown"];
  locale: Locale;
  t: ScoresDict;
}) {
  const active = typeof total === "number" ? findBand(score.interpretation, total) : undefined;
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">{t.rubricTitle}</p>
        <ul className="space-y-1.5">
          {score.components.map((comp) => {
            const row = breakdown.find((r) => r.label.en === comp.label.en);
            return (
              <li key={comp.id} className="text-xs">
                <span className="font-medium text-foreground">{comp.label[locale]}</span>
                <ul className="mt-0.5 space-y-0.5 ps-3">
                  {comp.options.map((o, i) => {
                    const isActive =
                      row != null && row.value.en === o.value.en && row.points === o.points;
                    return (
                      <li
                        key={i}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded px-1.5 py-0.5",
                          isActive
                            ? "bg-success/10 font-medium text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        <span>{o.value[locale]}</span>
                        <span className="shrink-0 tabular-nums">
                          {o.points >= 0 ? `+${o.points}` : o.points} {t.pointsLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">{t.fullScaleTitle}</p>
        <ul className="space-y-1">
          {score.interpretation.map((band, i) => {
            const isActive = active != null && band.min === active.min && band.max === active.max;
            return (
              <li
                key={i}
                className={cn(
                  "flex items-start justify-between gap-3 rounded-md px-2 py-1 text-xs",
                  isActive ? "bg-success/10 font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                <span>
                  {band.label[locale]}
                  {band.detail && (
                    <span className="text-muted-foreground"> — {band.detail[locale]}</span>
                  )}
                </span>
                <span className="shrink-0 tabular-nums">
                  {band.min === band.max ? band.min : `${band.min}–${band.max}`}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ClassifyScale({
  score,
  question,
  locale,
  t,
}: {
  score: Extract<ScoreSystem, { kind: "classify" }>;
  question: GeneratedQuestion;
  locale: Locale;
  t: ScoresDict;
}) {
  const sorted = [...score.categories].sort((a, b) => a.order - b.order);
  const activeCat = sorted.find((cat) => question.result.en.includes(cat.label.en));

  if (score.scaleTable) {
    const labelById = new Map(sorted.map((c) => [c.id, c.label]));
    return (
      <div className="space-y-1">
        <p className="text-xs font-semibold text-foreground">{t.fullScaleTitle}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="px-2 py-1 text-start font-semibold" />
                {score.scaleTable.columns.map((col, i) => (
                  <th key={i} className="px-2 py-1 text-start font-semibold whitespace-nowrap">
                    {col[locale]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {score.scaleTable.rows.map((row) => {
                const isActive = activeCat?.id === row.categoryId;
                return (
                  <tr
                    key={row.categoryId}
                    className={cn(
                      "border-b last:border-0",
                      isActive ? "bg-success/10 font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    <td className="px-2 py-1 font-medium text-foreground whitespace-nowrap">
                      {labelById.get(row.categoryId)?.[locale] ?? row.categoryId}
                    </td>
                    {row.cells.map((cell, i) => (
                      <td key={i} className="px-2 py-1 whitespace-nowrap tabular-nums">
                        {cell[locale]}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-foreground">{t.fullScaleTitle}</p>
      <ul className="space-y-1">
        {sorted.map((cat) => {
          const isActive = question.result.en.includes(cat.label.en);
          return (
            <li
              key={cat.id}
              className={cn(
                "rounded-md px-2 py-1 text-xs",
                isActive ? "bg-success/10 font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="font-medium text-foreground">{cat.label[locale]}</span>
              {cat.detail && (
                <span className="text-muted-foreground"> — {cat.detail[locale]}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DecodeScale({
  score,
  locale,
  t,
}: {
  score: Extract<ScoreSystem, { kind: "decode" }>;
  locale: Locale;
  t: ScoresDict;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-foreground">{t.positionsTitle}</p>
      <ul className="space-y-1.5">
        {score.positions.map((pos) => (
          <li key={pos.index} className="text-xs">
            <span className="font-medium text-foreground">
              {pos.index}. {pos.name[locale]}
            </span>
            <ul className="mt-0.5 space-y-0.5 ps-3 text-muted-foreground">
              {pos.letters.map((letter) => (
                <li key={letter.code}>
                  <span className="font-mono font-semibold text-foreground">{letter.code}</span>
                  {" — "}
                  {letter.meaning[locale]}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
