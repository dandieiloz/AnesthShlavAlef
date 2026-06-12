"use client";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ChevronRight, RotateCcw, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import type { ConfidenceLevel, GeneratedQuestion, ScoreSystem } from "@/lib/scores/types";
import { getScoreById, SCORE_CATEGORIES } from "@/lib/scores/registry";
import { generateScoreQuestion } from "@/lib/scores/generate";
import { rateScoreConfidenceAction, incrementScoreDrillSolvedAction } from "@/app/(user)/actions";
import { ScoreBreakdown } from "./ScoreBreakdown";

type ScoresT = ReturnType<typeof getDictionary>["scores"];

const CONF_ACTIVE: Record<ConfidenceLevel, string> = {
  CONFIDENT: "border-success bg-success/15 text-success",
  OK: "border-warning bg-warning/15 text-warning",
  WEAK: "border-destructive bg-destructive/15 text-destructive",
};

const CONF_LEVELS: ConfidenceLevel[] = ["CONFIDENT", "OK", "WEAK"];

function confLabel(level: ConfidenceLevel, t: ScoresT): string {
  return level === "CONFIDENT" ? t.confident : level === "OK" ? t.ok : t.weak;
}

function RateButtons({
  scoreId,
  value,
  onRate,
  t,
}: {
  scoreId: string;
  value: ConfidenceLevel | undefined;
  onRate: (scoreId: string, level: ConfidenceLevel) => void;
  t: ScoresT;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {CONF_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onRate(scoreId, level)}
          className={cn(
            "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            value === level
              ? CONF_ACTIVE[level]
              : "border-input text-muted-foreground hover:bg-muted",
          )}
        >
          {confLabel(level, t)}
        </button>
      ))}
    </div>
  );
}

export function ScoreDrillRunner({
  scoreIds,
  count,
  locale,
  confidence: initialConfidence,
}: {
  scoreIds: string[];
  count: number;
  locale: Locale;
  confidence: Record<string, ConfidenceLevel>;
}) {
  const t = getDictionary(locale).scores;
  const router = useRouter();
  const dir = locale === "he" ? "rtl" : "ltr";

  const scores = useMemo(
    () => scoreIds.map((id) => getScoreById(id)).filter((s): s is ScoreSystem => Boolean(s)),
    [scoreIds],
  );
  const categoryLabel = useMemo(() => {
    const map = new Map(SCORE_CATEGORIES.map((c) => [c.id, c.label]));
    return (score: ScoreSystem) => map.get(score.category);
  }, []);

  const makeQuestion = useCallback((): { score: ScoreSystem; question: GeneratedQuestion } => {
    const score = scores[Math.floor(Math.random() * scores.length)];
    return { score, question: generateScoreQuestion(score) };
  }, [scores]);

  const [current, setCurrent] = useState<{ score: ScoreSystem; question: GeneratedQuestion } | null>(
    null,
  );
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [confidence, setConfidence] = useState<Record<string, ConfidenceLevel>>(initialConfidence);
  const [, startTransition] = useTransition();

  // Generate the first question on the client only (avoids SSR/hydration
  // mismatch from Math.random).
  useEffect(() => {
    if (scores.length > 0) setCurrent(makeQuestion());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rate(scoreId: string, level: ConfidenceLevel) {
    setConfidence((c) => ({ ...c, [scoreId]: level }));
    startTransition(() => {
      void rateScoreConfidenceAction({ scoreId, level });
    });
  }

  function reveal() {
    setRevealed(true);
    startTransition(() => {
      void incrementScoreDrillSolvedAction();
    });
  }

  function handleNext() {
    if (step + 1 >= count) {
      setFinished(true);
      return;
    }
    setStep((s) => s + 1);
    setSelectedId(null);
    setRevealed(false);
    setCurrent(makeQuestion());
  }

  function restart() {
    setFinished(false);
    setStep(0);
    setSelectedId(null);
    setRevealed(false);
    setCurrent(makeQuestion());
  }

  if (scores.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {t.noScoresSelected}
        </CardContent>
      </Card>
    );
  }

  if (finished) {
    return (
      <div className="space-y-4" dir={dir}>
        <div>
          <h2 className="font-display text-xl font-bold">{t.finishTitle}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.finishSubtitle}</p>
        </div>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.reviewRatings}
            </p>
            <ul className="space-y-3">
              {scores.map((score) => (
                <li
                  key={score.id}
                  className="flex flex-col gap-2 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{score.abbrev}</div>
                    <div className="truncate text-xs text-muted-foreground">{score.name[locale]}</div>
                  </div>
                  <RateButtons scoreId={score.id} value={confidence[score.id]} onRate={rate} t={t} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={restart} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            {t.restart}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.push("/study")} className="gap-2">
            <Home className="h-4 w-4" />
            {t.backToStudy}
          </Button>
        </div>
      </div>
    );
  }

  if (!current) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">{t.title}</CardContent>
      </Card>
    );
  }

  const { score, question } = current;
  const chosen = question.options.find((o) => o.id === selectedId);
  const answeredCorrectly = revealed && chosen?.correct === true;

  return (
    <div className="space-y-4" dir={dir}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{t.progress(step + 1, count)}</span>
        <Button type="button" variant="ghost" size="sm" onClick={() => router.push("/study")}>
          {t.backToStudy}
        </Button>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="default">{score.abbrev}</Badge>
            {categoryLabel(score) && (
              <span className="text-xs text-muted-foreground">{categoryLabel(score)![locale]}</span>
            )}
          </div>

          <ul className="space-y-1 text-sm">
            {question.findings.map((f, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                {f.label && <span className="font-medium text-muted-foreground">{f.label[locale]}:</span>}
                <span>{f.text[locale]}</span>
              </li>
            ))}
          </ul>

          <p className="font-medium">{question.stem[locale]}</p>

          <div className="space-y-2">
            {question.options.map((o) => {
              const isChosen = o.id === selectedId;
              let cls = "border-input hover:bg-muted/50";
              if (revealed) {
                if (o.correct) cls = "border-success bg-success/10";
                else if (isChosen) cls = "border-destructive bg-destructive/10";
                else cls = "border-input opacity-60";
              } else if (isChosen) {
                cls = "border-primary bg-primary/5 ring-1 ring-primary";
              }
              return (
                <button
                  key={o.id}
                  type="button"
                  disabled={revealed}
                  onClick={() => setSelectedId(o.id)}
                  className={cn(
                    "w-full rounded-md border px-3 py-2 text-start text-sm transition-colors disabled:cursor-default",
                    cls,
                  )}
                >
                  {o.label[locale]}
                </button>
              );
            })}
          </div>

          {!revealed ? (
            <Button
              type="button"
              className="w-full gap-2"
              disabled={selectedId === null}
              onClick={reveal}
            >
              <Check className="h-4 w-4" />
              {t.check}
            </Button>
          ) : (
            <div className="space-y-4">
              <p
                className={cn(
                  "text-sm font-semibold",
                  answeredCorrectly ? "text-success" : "text-destructive",
                )}
              >
                {answeredCorrectly ? t.correct : t.incorrect}
              </p>

              <ScoreBreakdown question={question} score={score} locale={locale} />

              <div className="space-y-2 rounded-lg border bg-card p-3">
                <p className="text-sm font-medium">{t.ratePrompt}</p>
                <p className="text-xs text-muted-foreground">{t.rateHint}</p>
                <RateButtons scoreId={score.id} value={confidence[score.id]} onRate={rate} t={t} />
              </div>

              <Button type="button" className="w-full gap-2" onClick={handleNext}>
                {step + 1 >= count ? t.finish : t.next}
                <ChevronRight className={cn("h-4 w-4", dir === "rtl" && "rotate-180")} />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
