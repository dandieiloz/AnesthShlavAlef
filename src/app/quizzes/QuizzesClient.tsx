"use client";
import { useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { CheckCircle2, Clock, Trash2, Play, BookOpen } from "lucide-react";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

export interface QuizRow {
  id: number;
  name: string;
  chapterCount: number;
  createdAt: string;
  answered: number;
  total: number;
  correct: number;
  isComplete: boolean;
  accuracyPct: number;
  lastActivityAt: string | null;
}

export type QuizzesT = Dictionary["quizzes"];

function relativeDate(iso: string | null, locale: "he" | "en", t: QuizzesT): string {
  if (!iso) return "";
  const date = new Date(iso);
  const diffDays = Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return t.today;
  if (diffDays === 1) return t.yesterday;
  return date.toLocaleDateString(locale === "he" ? "he-IL" : "en-US");
}

function DeleteDialog({ quizId, quizName, t }: { quizId: number; quizName: string; t: QuizzesT }) {
  const [open, setOpen] = useState(false);
  const [resetQuestions, setResetQuestions] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResetQuestions(false); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.deleteTitle}</DialogTitle>
          <DialogDescription>
            {t.deleteDesc.replace("{name}", quizName)}
          </DialogDescription>
        </DialogHeader>
        <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
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
          <form
            action={deleteQuizAction}
            onSubmit={() => setOpen(false)}
          >
            <input type="hidden" name="quizId" value={quizId} />
            {resetQuestions && <input type="hidden" name="resetQuestions" value="on" />}
            <Button variant="destructive" type="submit">{t.delete}</Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuizCard({ q, locale, t }: { q: QuizRow; locale: "he" | "en"; t: QuizzesT }) {
  const progressPct = q.total > 0 ? Math.round((q.answered / q.total) * 100) : 0;
  return (
    <Card className="transition-all hover:shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm line-clamp-1">{q.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3" />
              {relativeDate(q.createdAt, locale, t)}
              {" \u00b7 "}
              {q.chapterCount} {q.chapterCount === 1 ? t.chapter : t.chapters}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {q.isComplete ? (
              <Badge className="text-xs bg-success/15 text-success border-success/30 gap-1">
                <CheckCircle2 className="h-3 w-3" />
                {t.completed}
              </Badge>
            ) : q.answered > 0 ? (
              <Badge variant="secondary" className="text-xs gap-1">
                <Play className="h-3 w-3" />
                {t.inProgress}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">{t.notStarted}</Badge>
            )}
            <DeleteDialog quizId={q.id} quizName={q.name} t={t} />
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground" dir={locale === "he" ? "rtl" : "ltr"}>
            <span>{q.answered}/{q.total} {t.questionsLabel}</span>
            {q.answered > 0 && (
              <span className={`font-medium ${q.accuracyPct >= 70 ? "text-success" : q.accuracyPct >= 50 ? "text-amber-500" : "text-destructive"}`}>
                {q.accuracyPct}% {t.accuracy}
              </span>
            )}
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        <div className="flex justify-end">
          <Button asChild size="sm" variant={q.isComplete ? "outline" : "default"} className="gap-1.5 h-7 text-xs">
            <Link href={q.isComplete ? `/quiz/${q.id}/review` : `/quiz/${q.id}`}>
              {q.isComplete ? (
                <><BookOpen className="h-3.5 w-3.5" />{t.review}</>
              ) : (
                <><Play className="h-3.5 w-3.5" />{q.answered > 0 ? t.continue : t.start}</>
              )}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function QuizzesClient({ quizzes, locale }: { quizzes: QuizRow[]; locale: Locale }) {
  const t = getDictionary(locale).quizzes;
  const DEFAULT_VISIBLE = 5;
  const [expanded, setExpanded] = useState(false);
  const expandLabel = locale === "he" ? "הצג עוד" : "Show more";
  const collapseLabel = locale === "he" ? "הצג פחות" : "Show less";
  const all = quizzes;
  const inProgress = quizzes.filter((q) => !q.isComplete && q.answered > 0);
  const completed = quizzes.filter((q) => q.isComplete);
  const notStarted = quizzes.filter((q) => q.answered === 0);

  function EmptyState() {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm text-muted-foreground py-12">
          {t.empty_filter}
        </CardContent>
      </Card>
    );
  }

  function Grid({ items }: { items: QuizRow[] }) {
    if (items.length === 0) return <EmptyState />;
    const visibleItems = expanded ? items : items.slice(0, DEFAULT_VISIBLE);
    const canToggle = items.length > DEFAULT_VISIBLE;
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleItems.map((q) => <QuizCard key={q.id} q={q} locale={locale} t={t} />)}
        </div>
        {canToggle && (
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => setExpanded((v) => !v)}>
              {expanded ? collapseLabel : expandLabel}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <Tabs defaultValue="all" dir={locale === "he" ? "rtl" : "ltr"}>
      <TabsList>
        <TabsTrigger value="all">{t.tabAll} ({all.length})</TabsTrigger>
        <TabsTrigger value="in-progress">{t.tabInProgress} ({inProgress.length})</TabsTrigger>
        <TabsTrigger value="completed">{t.tabCompleted} ({completed.length})</TabsTrigger>
        <TabsTrigger value="not-started">{t.tabNotStarted} ({notStarted.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="all"><Grid items={all} /></TabsContent>
      <TabsContent value="in-progress"><Grid items={inProgress} /></TabsContent>
      <TabsContent value="completed"><Grid items={completed} /></TabsContent>
      <TabsContent value="not-started"><Grid items={notStarted} /></TabsContent>
    </Tabs>
  );
}
