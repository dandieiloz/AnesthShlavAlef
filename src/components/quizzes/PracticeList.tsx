"use client";
import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteQuizAction } from "@/app/(user)/actions";
import { CheckCircle2, Trash2, Play, BookOpen, RotateCcw } from "lucide-react";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { formatRelativeDay } from "@/lib/format-time";
import { useRelativeNow } from "@/lib/use-relative-now";
import { cn } from "@/lib/utils";

export interface QuizRow {
  id: number;
  name: string;
  chapters: { number: number; title: string }[];
  createdAt: string;
  lastActivityAt: string | null;
  answered: number;
  total: number;
  correct: number;
  wrong: number;
  isComplete: boolean;
  accuracyPct: number;
}

type QuizzesT = Dictionary["quizzes"];
type Filter = "all" | "active" | "completed";

const MAX_CHAPTER_CHIPS = 3;

function relativeDate(iso: string, locale: Locale, t: QuizzesT, nowMs: number | null): string {
  // Before hydration, render a stable absolute date to avoid a mismatch.
  if (nowMs === null) {
    return new Date(iso).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", {
      timeZone: "Asia/Jerusalem",
    });
  }
  return formatRelativeDay(iso, nowMs, locale, { today: t.today, yesterday: t.yesterday });
}

function accuracyClass(pct: number) {
  return pct >= 70 ? "text-success" : pct >= 50 ? "text-amber-500" : "text-destructive";
}

/** One bar that shows correct, wrong and not-yet-answered as segments. */
export function ResultBar({ q, className }: { q: QuizRow; className?: string }) {
  const total = Math.max(q.total, q.answered, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div
      className={cn("flex h-2 w-full overflow-hidden rounded-full bg-muted", className)}
      role="img"
      aria-label={`${q.correct} / ${q.wrong} / ${Math.max(0, q.total - q.answered)}`}
    >
      <div className="h-full bg-success transition-all" style={{ width: pct(q.correct) }} />
      <div className="h-full bg-destructive/80 transition-all" style={{ width: pct(q.wrong) }} />
    </div>
  );
}

function ResultLine({ q, t }: { q: QuizRow; t: QuizzesT }) {
  if (q.answered === 0) {
    return <p className="text-xs text-muted-foreground">{t.noAnswersYet}</p>;
  }
  const remaining = Math.max(0, q.total - q.answered);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-success" />
        {q.correct} {t.correctCount}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-destructive/80" />
        {q.wrong} {t.wrongCount}
      </span>
      {remaining > 0 && (
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
          {remaining} {t.remainingCount}
        </span>
      )}
    </p>
  );
}

function ChapterChips({ q, t }: { q: QuizRow; t: QuizzesT }) {
  const shown = q.chapters.slice(0, MAX_CHAPTER_CHIPS);
  const extra = q.chapters.length - shown.length;
  if (q.chapters.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((c) => (
        <span
          key={c.number}
          title={c.title}
          className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground"
        >
          {t.chapter} {c.number}
        </span>
      ))}
      {extra > 0 && (
        <span
          className="text-[11px] text-muted-foreground"
          title={q.chapters.slice(MAX_CHAPTER_CHIPS).map((c) => `${c.number}. ${c.title}`).join("\n")}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

function StatusBadge({ q, t }: { q: QuizRow; t: QuizzesT }) {
  if (q.isComplete) {
    return (
      <Badge className="gap-1 border-success/30 bg-success/15 text-xs text-success">
        <CheckCircle2 className="h-3 w-3" />
        {t.completed}
      </Badge>
    );
  }
  if (q.answered > 0) {
    return <Badge variant="secondary" className="text-xs">{t.inProgress}</Badge>;
  }
  return <Badge variant="outline" className="text-xs text-muted-foreground">{t.notStarted}</Badge>;
}

function DeleteDialog({ quizId, quizName, t }: { quizId: number; quizName: string; t: QuizzesT }) {
  const [open, setOpen] = useState(false);
  const [resetQuestions, setResetQuestions] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResetQuestions(false); }}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={t.deleteQuiz}
          title={t.deleteQuiz}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.deleteTitle}</DialogTitle>
          <DialogDescription>{t.deleteDesc.replace("{name}", quizName)}</DialogDescription>
        </DialogHeader>
        <label className="flex cursor-pointer select-none items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-destructive"
            checked={resetQuestions}
            onChange={(e) => setResetQuestions(e.target.checked)}
          />
          <span className="text-muted-foreground">{t.resetQuestionsLabel}</span>
        </label>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>{t.cancel}</Button>
          <form action={deleteQuizAction} onSubmit={() => setOpen(false)}>
            <input type="hidden" name="quizId" value={quizId} />
            {resetQuestions && <input type="hidden" name="resetQuestions" value="on" />}
            <Button variant="destructive" type="submit">{t.delete}</Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PrimaryAction({ q, t, size = "sm" }: { q: QuizRow; t: QuizzesT; size?: "sm" | "default" }) {
  if (q.isComplete) {
    return (
      <Button asChild size={size} variant="outline" className="gap-1.5">
        <Link href={`/quiz/${q.id}/review`}>
          <BookOpen className="h-3.5 w-3.5" />
          {t.review}
        </Link>
      </Button>
    );
  }
  return (
    <Button asChild size={size} className="gap-1.5">
      <Link href={`/quiz/${q.id}`}>
        <Play className="h-3.5 w-3.5" />
        {q.answered > 0 ? t.continue : t.start}
      </Link>
    </Button>
  );
}

function MistakesAction({ q, t, size = "sm" }: { q: QuizRow; t: QuizzesT; size?: "sm" | "default" }) {
  if (q.wrong === 0) return null;
  return (
    <Button asChild size={size} variant="outline" className="gap-1.5">
      <Link href={`/quiz/${q.id}/review?wrong=1`}>
        <RotateCcw className="h-3.5 w-3.5" />
        {t.reviewMistakes} ({q.wrong})
      </Link>
    </Button>
  );
}

function QuizListItem({ q, locale, t, nowMs }: { q: QuizRow; locale: Locale; t: QuizzesT; nowMs: number | null }) {
  const when = q.lastActivityAt
    ? `${t.lastActivity}: ${relativeDate(q.lastActivityAt, locale, t, nowMs)}`
    : `${t.created}: ${relativeDate(q.createdAt, locale, t, nowMs)}`;
  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="line-clamp-1 text-sm font-semibold">{q.name}</p>
              <StatusBadge q={q} t={t} />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <ChapterChips q={q} t={t} />
              <span>{when}</span>
            </div>
          </div>
          {q.answered > 0 && (
            <div className="shrink-0 text-center">
              <p className={cn("font-display text-xl font-bold leading-none", accuracyClass(q.accuracyPct))}>
                {q.accuracyPct}%
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{t.accuracy}</p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <ResultBar q={q} />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ResultLine q={q} t={t} />
            <span className="text-xs tabular-nums text-muted-foreground">
              {q.answered}/{q.total} {t.questionsLabel}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PrimaryAction q={q} t={t} />
          <MistakesAction q={q} t={t} />
          <div className="ms-auto">
            <DeleteDialog quizId={q.id} quizName={q.name} t={t} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Large card for the quiz the user should pick up next. Used on Home. */
export function ContinueQuizCard({ q, locale, title }: { q: QuizRow; locale: Locale; title: string }) {
  const t = getDictionary(locale).quizzes;
  const nowMs = useRelativeNow();
  return (
    <Card className="h-full border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary">{title}</p>
          <p className="font-display text-lg font-bold leading-snug">{q.name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <ChapterChips q={q} t={t} />
            {q.lastActivityAt && (
              <span>
                {t.lastActivity}: {relativeDate(q.lastActivityAt, locale, t, nowMs)}
              </span>
            )}
          </div>
        </div>
        <div className="space-y-1.5">
          <ResultBar q={q} className="h-2.5" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ResultLine q={q} t={t} />
            <span className="text-xs tabular-nums text-muted-foreground">
              {q.answered}/{q.total} {t.questionsLabel}
            </span>
          </div>
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <PrimaryAction q={q} t={t} size="default" />
          <MistakesAction q={q} t={t} size="default" />
        </div>
      </CardContent>
    </Card>
  );
}

export function PracticeList({
  quizzes,
  locale,
  showFilters = false,
}: {
  quizzes: QuizRow[];
  locale: Locale;
  showFilters?: boolean;
}) {
  const t = getDictionary(locale).quizzes;
  const nowMs = useRelativeNow();
  const [filter, setFilter] = useState<Filter>("all");

  const active = quizzes.filter((q) => !q.isComplete);
  const completed = quizzes.filter((q) => q.isComplete);
  const visible = filter === "active" ? active : filter === "completed" ? completed : quizzes;

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t.tabAll, count: quizzes.length },
    { key: "active", label: t.filterActive, count: active.length },
    { key: "completed", label: t.tabCompleted, count: completed.length },
  ];

  return (
    <div className="space-y-3">
      {showFilters && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={filter === c.key}
              onClick={() => setFilter(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === c.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c.label} ({c.count})
            </button>
          ))}
        </div>
      )}
      {visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t.empty_filter}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((q) => (
            <QuizListItem key={q.id} q={q} locale={locale} t={t} nowMs={nowMs} />
          ))}
        </div>
      )}
    </div>
  );
}
