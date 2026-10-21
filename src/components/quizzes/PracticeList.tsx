"use client";
import { useState, useTransition } from "react";
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
import { deleteUnstartedQuizzesAction } from "@/app/(user)/quiz-list-actions";
import { CheckCircle2, Trash2, Play, BookOpen, RotateCcw, ChevronDown, CircleDashed } from "lucide-react";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { formatRelativeTime } from "@/lib/format-time";
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
  /** Correctness of each answer, oldest first. */
  results: boolean[];
  /** Estimated minutes to finish at the user's usual pace; null when done. */
  minutesLeft: number | null;
  /** Other residents' accuracy on the same questions; null when too few attempts. */
  communityPct: number | null;
}

type QuizzesT = Dictionary["quizzes"];
type Filter = "all" | "active" | "completed";

/** Quizzes up to this size get one dot per question; larger ones get a bar. */
const MAX_DOTS = 20;
/** Accuracy is only meaningful after a handful of answers. */
const MIN_ANSWERS_FOR_ACCURACY = 5;
/** Up to this many chapters are named individually in a quiz title. */
const MAX_NAMED_CHAPTERS = 2;

// Names the builder generates automatically ("פרק 12", "פרקים 3, 4 · 21.10", "Chapter 5").
const AUTO_CHAPTER_NAME = /^(פרק|פרקים|Chapter|Chapters)\s/;

/** Topic-first title: the chapter title(s) for chapter quizzes, otherwise the quiz name. */
function quizHeading(q: QuizRow, t: QuizzesT): { title: string; detail: string | null } {
  const nums = q.chapters.map((c) => c.number);
  const isAuto = AUTO_CHAPTER_NAME.test(q.name);
  if (isAuto && q.chapters.length > 0) {
    if (q.chapters.length <= MAX_NAMED_CHAPTERS) {
      return { title: q.chapters.map((c) => c.title).join(" · "), detail: t.chapterNums(nums) };
    }
    return { title: t.mixedTopics(q.chapters.length), detail: null };
  }
  if (q.chapters.length === 0) return { title: q.name, detail: null };
  return {
    title: q.name,
    detail: q.chapters.length <= 3 ? t.chapterNums(nums) : t.chaptersCount(q.chapters.length),
  };
}

function relative(iso: string, locale: Locale, nowMs: number | null): string {
  // Before hydration, render a stable absolute date to avoid a mismatch.
  if (nowMs === null) {
    return new Date(iso).toLocaleDateString(locale === "he" ? "he-IL" : "en-US", { timeZone: "Asia/Jerusalem" });
  }
  return formatRelativeTime(iso, nowMs, locale);
}

function accuracyClass(pct: number) {
  return pct >= 70 ? "text-success" : pct >= 50 ? "text-amber-500" : "text-destructive";
}

/** One dot per question (green, red, empty) for small quizzes; a split bar for big ones. */
export function ResultStrip({ q, className }: { q: QuizRow; className?: string }) {
  const total = Math.max(q.total, q.answered);
  const label = `${q.correct} ✓ · ${q.wrong} ✗ · ${Math.max(0, total - q.answered)}`;
  if (total > 0 && total <= MAX_DOTS) {
    return (
      <div className={cn("flex flex-wrap gap-1", className)} role="img" aria-label={label}>
        {Array.from({ length: total }, (_, i) => {
          const r = q.results[i];
          return (
            <span
              key={i}
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                r === true ? "bg-success" : r === false ? "bg-destructive/80" : "border border-muted-foreground/30",
              )}
            />
          );
        })}
      </div>
    );
  }
  const pct = (n: number) => `${(n / Math.max(total, 1)) * 100}%`;
  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-full bg-muted", className)} role="img" aria-label={label}>
      <div className="h-full bg-success" style={{ width: pct(q.correct) }} />
      <div className="h-full bg-destructive/80" style={{ width: pct(q.wrong) }} />
    </div>
  );
}

/** "Answered 1 of 10" until there's enough data, then correct / wrong / left. */
function ResultLine({ q, t }: { q: QuizRow; t: QuizzesT }) {
  const remaining = Math.max(0, q.total - q.answered);
  const time = q.minutesLeft !== null ? <span>{t.timeLeft(q.minutesLeft)}</span> : null;
  if (q.answered < MIN_ANSWERS_FOR_ACCURACY) {
    return (
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{t.answeredOf(q.answered, q.total)}</span>
        {time}
      </p>
    );
  }
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span>
        {q.correct} {t.correctCount}
      </span>
      <span>
        {q.wrong} {t.wrongCount}
      </span>
      {remaining > 0 && <span>{t.left(remaining)}</span>}
      {time}
    </p>
  );
}

function Accuracy({ q, t, large = false }: { q: QuizRow; t: QuizzesT; large?: boolean }) {
  if (q.answered < MIN_ANSWERS_FOR_ACCURACY) return null;
  return (
    <div className="shrink-0 text-center">
      <p className={cn("font-display font-bold leading-none", large ? "text-2xl" : "text-xl", accuracyClass(q.accuracyPct))}>
        {q.accuracyPct}%
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.accuracy}</p>
      {q.communityPct !== null && (
        <p
          className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground"
          title={t.communityAvgHint}
        >
          {t.communityAvg(q.communityPct)}
        </p>
      )}
    </div>
  );
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

function Heading({ q, t, when, large = false }: { q: QuizRow; t: QuizzesT; when: string; large?: boolean }) {
  const { title, detail } = quizHeading(q, t);
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <p dir="auto" className={cn("line-clamp-2 font-semibold leading-snug", large ? "font-display text-lg" : "text-sm")} title={q.name}>
          {title}
        </p>
        {q.isComplete && (
          <Badge className="gap-1 border-success/30 bg-success/15 text-xs text-success">
            <CheckCircle2 className="h-3 w-3" />
            {t.completed}
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{[detail, when].filter(Boolean).join(" · ")}</p>
    </div>
  );
}

function QuizListItem({ q, locale, t, nowMs }: { q: QuizRow; locale: Locale; t: QuizzesT; nowMs: number | null }) {
  const when = relative(q.lastActivityAt ?? q.createdAt, locale, nowMs);
  return (
    <Card className="transition-shadow hover:shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <Heading q={q} t={t} when={when} />
          <Accuracy q={q} t={t} />
        </div>
        <div className="space-y-1.5">
          <ResultStrip q={q} />
          <ResultLine q={q} t={t} />
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
  const when = relative(q.lastActivityAt ?? q.createdAt, locale, nowMs);
  return (
    <Card className="h-full border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="flex h-full flex-col gap-4 p-5">
        <div className="space-y-1">
          <p className="text-xs font-medium text-primary">{title}</p>
          <div className="flex items-start justify-between gap-3">
            <Heading q={q} t={t} when={when} large />
            <Accuracy q={q} t={t} large />
          </div>
        </div>
        <div className="space-y-1.5">
          <ResultStrip q={q} />
          <ResultLine q={q} t={t} />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2">
          <PrimaryAction q={q} t={t} size="default" />
          <MistakesAction q={q} t={t} size="default" />
        </div>
      </CardContent>
    </Card>
  );
}

/** Never-started quizzes, folded into one line with a bulk delete. */
function UnstartedGroup({ quizzes, locale, t, nowMs }: { quizzes: QuizRow[]; locale: Locale; t: QuizzesT; nowMs: number | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  if (quizzes.length === 0) return null;
  return (
    <div className="rounded-lg border border-dashed bg-muted/20">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t.notStartedGroup(quizzes.length)}</span>
        <div className="ms-auto flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 text-xs"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
          >
            {open ? t.hide : t.show}
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              if (!confirm(t.confirmDeleteEmpty(quizzes.length))) return;
              startTransition(async () => {
                await deleteUnstartedQuizzesAction();
              });
            }}
          >
            {t.deleteAllEmpty}
          </Button>
        </div>
      </div>
      {open && (
        <div className="grid gap-3 border-t p-3 md:grid-cols-2">
          {quizzes.map((q) => (
            <QuizListItem key={q.id} q={q} locale={locale} t={t} nowMs={nowMs} />
          ))}
        </div>
      )}
    </div>
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

  const started = quizzes.filter((q) => q.answered > 0);
  const unstarted = quizzes.filter((q) => q.answered === 0);
  const active = started.filter((q) => !q.isComplete);
  const completed = started.filter((q) => q.isComplete);
  const visible = filter === "active" ? active : filter === "completed" ? completed : started;

  const chips: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t.tabAll, count: started.length },
    { key: "active", label: t.filterActive, count: active.length },
    { key: "completed", label: t.tabCompleted, count: completed.length },
  ];

  return (
    <div className="space-y-3">
      {showFilters && started.length > 0 && (
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
      {visible.length === 0 && started.length > 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">{t.empty_filter}</CardContent>
        </Card>
      ) : (
        visible.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {visible.map((q) => (
              <QuizListItem key={q.id} q={q} locale={locale} t={t} nowMs={nowMs} />
            ))}
          </div>
        )
      )}
      {showFilters && <UnstartedGroup quizzes={unstarted} locale={locale} t={t} nowMs={nowMs} />}
    </div>
  );
}
