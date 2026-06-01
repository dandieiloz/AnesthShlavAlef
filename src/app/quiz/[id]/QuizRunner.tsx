"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ArrowRight,
  BarChart2,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RotateCcw,
  X,
  XCircle,
} from "lucide-react";
import { AnswerExplanation } from "@/components/AnswerExplanation";
import { ReportAnswerForm } from "@/components/ReportAnswerForm";
import {
  loadQuizBatchAction,
  recordAttemptAction,
  toggleBookmarkValueAction,
} from "@/app/(user)/actions";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import type { Choice, QuestionPayload } from "./quiz-session";

const HEBREW_LETTERS = ["א", "ב", "ג", "ד"];
const OPTION_KEYS = ["A", "B", "C", "D"] as const;
const REFILL_THRESHOLD = 2;
const MODE_STORAGE_KEY = "quizAnswerMode";
type AnswerMode = "immediate" | "full";

type Props = {
  quizId: number;
  quizName: string;
  contentLocale: "he" | "en";
  uiLocale: Locale;
  totalQ: number;
  initialAnswered: number;
  initialCorrect: number;
  initialBatch: QuestionPayload[];
  initialHasMore: boolean;
};

export function QuizRunner(props: Props) {
  const dict = getDictionary(props.uiLocale);
  const t = dict.quiz;
  const common = dict.common;
  const router = useRouter();

  const [queue, setQueue] = useState<QuestionPayload[]>(props.initialBatch);
  const [hasMore, setHasMore] = useState(props.initialHasMore);
  const [answered, setAnswered] = useState(props.initialAnswered);
  const [correct, setCorrect] = useState(props.initialCorrect);

  const [chosen, setChosen] = useState<Choice | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<AnswerMode>("immediate");
  // Stack of previously-visited questions. `chosen` is null when the user
  // skipped the question (no Attempt recorded). The "previous question" button
  // walks both answered and skipped entries.
  const [past, setPast] = useState<{ question: QuestionPayload; chosen: Choice | null }[]>([]);
  // -1 = viewing the live (current) question; otherwise index into `past`.
  const [viewingIndex, setViewingIndex] = useState<number>(-1);
  // Gates the pre-finish summary: once the user opts to "finish anyway" we
  // fall through to the existing finished screen even with skipped questions.
  const [finishConfirmed, setFinishConfirmed] = useState(false);
  // Per-question set of options the user has eliminated (struck-through, not
  // selectable). Cleared per question on successful submit; preserved across
  // skip/back navigation otherwise.
  const [eliminated, setEliminated] = useState<Record<number, Choice[]>>({});
  const [, startTransition] = useTransition();
  const refillInFlight = useRef(false);
  // Synchronous guards: state-based `submitting` is read from a stale closure
  // when handleSubmit fires twice in the same tick (key repeat, double-click,
  // form Enter + button click). Refs let us bail out before scheduling a
  // second recordAttempt for the same question.
  const submittingRef = useRef(false);
  const lastRecordedQuestionId = useRef<number | null>(null);

  // Load persisted mode after mount (avoid SSR/CSR mismatch).
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === "immediate" || stored === "full") setMode(stored);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const changeMode = useCallback((next: AnswerMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  // Track every question id we have served the client (consumed or queued), so
  // refill requests don't redeliver the same one before the server has seen
  // the new Attempt rows.
  const servedIds = useRef<Set<number>>(new Set(props.initialBatch.map((q) => q.id)));

  const current = queue[0];
  const remainingAfterCurrent = queue.length - 1;

  const refill = useCallback(async () => {
    if (refillInFlight.current || !hasMore) return;
    refillInFlight.current = true;
    try {
      const result = await loadQuizBatchAction({
        quizId: props.quizId,
        excludeIds: Array.from(servedIds.current),
        count: 5,
      });
      const fresh = result.questions.filter((q) => !servedIds.current.has(q.id));
      if (fresh.length > 0) {
        for (const q of fresh) servedIds.current.add(q.id);
        setQueue((prev) => [...prev, ...fresh]);
      }
      setHasMore(result.hasMore);
    } catch (err) {
      console.error("[quiz] failed to load next batch", err);
    } finally {
      refillInFlight.current = false;
    }
  }, [hasMore, props.quizId]);

  // Background-refill when the queue runs low.
  useEffect(() => {
    if (remainingAfterCurrent < REFILL_THRESHOLD && hasMore) {
      void refill();
    }
  }, [remainingAfterCurrent, hasMore, refill]);

  // If the queue is empty but more is available on the server, fetch it
  // before showing the finished screen.
  useEffect(() => {
    if (queue.length === 0 && hasMore) void refill();
  }, [queue.length, hasMore, refill]);

  const totalForProgress = Math.max(props.totalQ, answered);
  const progressPct = totalForProgress > 0 ? Math.round((answered / totalForProgress) * 100) : 0;

  // ── Finished ────────────────────────────────────────────────────────────
  if (queue.length === 0 && !hasMore && !refillInFlight.current) {
    const pendingSkipped = past.filter((p) => p.chosen === null).map((p) => p.question);
    // If there are skipped questions, give the user a chance to answer them
    // before showing the finish screen or jumping to /review.
    if (pendingSkipped.length > 0 && !finishConfirmed) {
      return (
        <div className="mx-auto max-w-2xl animate-fade-in py-10">
          <div className="text-center">
            <h1 className="font-display text-2xl font-bold">{t.unansweredTitle}</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {t.unansweredIntro(pendingSkipped.length)}
            </p>
          </div>
          <Card className="mt-6">
            <CardContent className="pt-5 pb-5">
              <ul className="divide-y">
                {pendingSkipped.map((q) => (
                  <li key={q.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {common.chapter} {q.chapter.number}
                    </Badge>
                    <span className="line-clamp-2 text-sm leading-snug">{q.stem}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={() => requeueSkipped(pendingSkipped)}>
              {t.answerSkipped}
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setFinishConfirmed(true)}
            >
              {t.finishAnyway}
            </Button>
          </div>
        </div>
      );
    }
    if (mode === "full") {
      // Skip the inline summary and jump straight to סקירה.
      router.replace(`/quiz/${props.quizId}/review`);
      return (
        <div className="mx-auto max-w-3xl py-20 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          <p className="text-sm">{t.loadingNext}</p>
        </div>
      );
    }
    const accuracyPct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    return (
      <div className="mx-auto max-w-lg animate-fade-in py-16 text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-8 w-8 text-success" />
        </div>
        <h1 className="font-display text-3xl font-bold">{t.finishedTitle}</h1>
        <p className="mt-3 text-muted-foreground">
          {t.finishedSummary(correct, answered, accuracyPct)}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button asChild size="lg">
            <Link href={`/quiz/${props.quizId}/review`} className="gap-2">
              <ClipboardList className="h-4 w-4" />
              {t.reviewAnswers}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/study" className="gap-2">
              <BarChart2 className="h-4 w-4" />
              {t.backToStats}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg">
            <Link href="/study/new">{t.newQuiz}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading next (queue temporarily empty while refilling) ─────────────
  if (!current) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center text-muted-foreground">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        <p className="text-sm">{t.loadingNext}</p>
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (viewingIndex !== -1) return;
    if (!chosen || submittingRef.current) return;
    if (mode === "immediate" && revealed) return;
    const questionId = current!.id;
    // Block re-submission for the same question even if `submitting` state hasn't
    // committed yet (key-repeat / double-fire).
    if (lastRecordedQuestionId.current === questionId) return;
    submittingRef.current = true;
    lastRecordedQuestionId.current = questionId;
    setSubmitting(true);

    // Optimistic counters; server confirms in background.
    const isCorrect = chosen === current!.answer.correctAnswer;
    setAnswered((n) => n + 1);
    if (isCorrect) setCorrect((n) => n + 1);
    // Drop eliminations for this question — it's answered now.
    setEliminated((prev) => {
      if (!(questionId in prev)) return prev;
      const { [questionId]: _drop, ...rest } = prev;
      return rest;
    });

    if (mode === "immediate") {
      setRevealed(true);
    } else {
      // Full-quiz mode: silently advance without revealing.
      setPast((prev) => [...prev, { question: current!, chosen: chosen! }]);
      setQueue((prev) => prev.slice(1));
      setChosen(null);
      setRevealed(false);
    }

    const payload = { quizId: props.quizId, questionId, chosen };
    startTransition(() => {
      recordAttemptAction(payload)
        .catch((err) => console.error("[quiz] failed to record attempt", err))
        .finally(() => {
          submittingRef.current = false;
          setSubmitting(false);
        });
    });
  }

  function handleNext() {
    // If we're reviewing a past question, step forward through past until we
    // run out and then return to the live question.
    if (viewingIndex !== -1) {
      if (viewingIndex < past.length - 1) {
        setViewingIndex(viewingIndex + 1);
      } else {
        setViewingIndex(-1);
      }
      return;
    }
    // Live immediate-mode advance after revealing the answer.
    setPast((prev) => [...prev, { question: current!, chosen: chosen! }]);
    setQueue((prev) => prev.slice(1));
    setChosen(null);
    setRevealed(false);
    // Allow the next question to be recorded.
    lastRecordedQuestionId.current = null;
  }

  function handlePrev() {
    if (past.length === 0) return;
    if (viewingIndex === -1) {
      setViewingIndex(past.length - 1);
    } else if (viewingIndex > 0) {
      setViewingIndex(viewingIndex - 1);
    }
  }

  function handleSkip() {
    if (!current) return;
    // Always skip the LIVE current question, even if the user is currently
    // viewing a past question — return them to the live view first.
    setPast((prev) => [...prev, { question: current, chosen: null }]);
    setQueue((prev) => prev.slice(1));
    setChosen(null);
    setRevealed(false);
    setViewingIndex(-1);
    lastRecordedQuestionId.current = null;
  }

  function toggleEliminated(questionId: number, key: Choice) {
    setEliminated((prev) => {
      const current = prev[questionId] ?? [];
      const next = current.includes(key)
        ? current.filter((k) => k !== key)
        : [...current, key];
      return { ...prev, [questionId]: next };
    });
    // If we just eliminated the currently-chosen option on the LIVE question,
    // clear the selection so Submit becomes disabled.
    if (viewingIndex === -1 && chosen === key) {
      const already = eliminated[questionId]?.includes(key) ?? false;
      if (!already) setChosen(null);
    }
  }

  function requeueSkipped(questions: QuestionPayload[]) {
    if (questions.length === 0) return;
    const ids = new Set(questions.map((q) => q.id));
    setPast((prev) => prev.filter((p) => !(p.chosen === null && ids.has(p.question.id))));
    setQueue((prev) => [...questions, ...prev]);
    setViewingIndex(-1);
    setChosen(null);
    setRevealed(false);
    lastRecordedQuestionId.current = null;
  }

  const isViewingPast = viewingIndex !== -1;
  const pastEntry = isViewingPast ? past[viewingIndex] : null;
  const isViewingSkipped = pastEntry !== null && pastEntry.chosen === null;
  const display = pastEntry ? pastEntry.question : current;
  const displayChosen: Choice | null = pastEntry ? pastEntry.chosen : chosen;
  const displayRevealed = pastEntry ? pastEntry.chosen !== null : revealed;
  const correctChoice = display.answer.correctAnswer;
  const isCorrectChoice = displayRevealed && displayChosen === correctChoice;
  const showReveal = displayRevealed && (isViewingPast || mode === "immediate");
  const canGoPrev = past.length > 0 && (viewingIndex === -1 || viewingIndex > 0);
  const skippedRemaining = past.filter((p) => p.chosen === null).map((p) => p.question);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="space-y-5">
        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{props.quizName}</span>
            <span>
              {mode === "immediate"
                ? t.progress(answered, props.totalQ, correct)
                : t.progressNoCorrect(answered, props.totalQ)}
            </span>
          </div>
          <Progress value={progressPct} className="h-1.5" />
        </div>

        {/* Answer-mode toggle */}
        <div
          className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs"
          role="group"
          aria-label={t.modeAriaLabel}
        >
          <button
            type="button"
            onClick={() => changeMode("immediate")}
            aria-pressed={mode === "immediate"}
            className={`rounded px-3 py-1.5 transition-colors ${
              mode === "immediate"
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.modeImmediate}
          </button>
          <button
            type="button"
            onClick={() => changeMode("full")}
            aria-pressed={mode === "full"}
            className={`rounded px-3 py-1.5 transition-colors ${
              mode === "full"
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.modeFull}
          </button>
        </div>

        {/* Chapter pill + bookmark */}
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {common.chapter} {display.chapter.number}
          </Badge>
          <span className="text-xs text-muted-foreground flex-1">{display.chapter.title}</span>
          <BookmarkToggle
            questionId={display.id}
            initialBookmarked={display.bookmarked}
            labels={{
              add: t.addBookmark,
              remove: t.removeBookmark,
              bookmarked: t.bookmarked,
              bookmark: t.bookmark,
            }}
            onChange={(b) => {
              // mutate the queue entry in place so re-renders see the new state
              display.bookmarked = b;
            }}
          />
        </div>

        {/* Question card */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <p className="font-display text-lg leading-relaxed">{display.stem}</p>
            {display.source && (
              <p className="text-xs text-muted-foreground">
                {t.source}: {display.source}
              </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {OPTION_KEYS.map((k, i) => {
                const isChosen = displayChosen === k;
                const isCorrectOption = displayRevealed && k === correctChoice;
                const isWrongChosen = displayRevealed && isChosen && k !== correctChoice;
                const isEliminated =
                  !displayRevealed && (eliminated[display.id]?.includes(k) ?? false);
                const canEliminate = !displayRevealed && !isViewingPast;
                const optionText = display[`option${k}` as "optionA" | "optionB" | "optionC" | "optionD"];
                return (
                  <label
                    key={k}
                    onClick={
                      isEliminated && canEliminate
                        ? (e) => {
                            e.preventDefault();
                            toggleEliminated(display.id, k);
                          }
                        : undefined
                    }
                    className={[
                      "flex items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors",
                      displayRevealed
                        ? "cursor-default"
                        : isEliminated
                        ? "cursor-pointer hover:border-border hover:bg-muted/60"
                        : "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
                      isCorrectOption
                        ? "border-success bg-success/10"
                        : isWrongChosen
                        ? "border-destructive bg-destructive/10"
                        : isEliminated
                        ? "border-border bg-muted/40 text-muted-foreground line-through opacity-60"
                        : isChosen
                        ? "border-primary bg-primary/5"
                        : "border-border bg-background",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="chosen"
                      value={k}
                      checked={isChosen}
                      onChange={() =>
                        !displayRevealed && !isViewingPast && !isEliminated && setChosen(k)
                      }
                      disabled={displayRevealed || isViewingPast || isEliminated}
                      required
                      className="sr-only"
                    />
                    <span
                      className={[
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                        isCorrectOption
                          ? "border-success bg-success text-white"
                          : isWrongChosen
                          ? "border-destructive bg-destructive text-white"
                          : "border-border bg-muted",
                      ].join(" ")}
                    >
                      {HEBREW_LETTERS[i]}
                    </span>
                    <span className="flex-1 leading-snug pt-0.5">{optionText}</span>
                    {canEliminate && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleEliminated(display.id, k);
                        }}
                        title={isEliminated ? t.restoreOption : t.eliminateOption}
                        aria-label={isEliminated ? t.restoreOption : t.eliminateOption}
                        className="-my-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {isEliminated ? (
                          <RotateCcw className="h-3.5 w-3.5" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                  </label>
                );
              })}

              {(() => {
                const prevBtn = canGoPrev ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    onClick={handlePrev}
                    className="gap-1.5"
                  >
                    <ArrowRight className="h-4 w-4 ltr:rotate-180" />
                    {t.previousQuestion}
                  </Button>
                ) : null;
                const skipBtn = current ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={handleSkip}
                  >
                    {t.skipQuestion}
                  </Button>
                ) : null;
                let mainBtn: React.ReactNode;
                if (displayRevealed) {
                  mainBtn = (
                    <Button type="button" className="flex-1" size="lg" onClick={handleNext}>
                      {t.nextQuestion}
                    </Button>
                  );
                } else if (isViewingSkipped) {
                  mainBtn = (
                    <Button
                      type="button"
                      className="flex-1"
                      size="lg"
                      onClick={() => requeueSkipped([pastEntry!.question])}
                    >
                      {t.answerSkipped}
                    </Button>
                  );
                } else {
                  mainBtn = (
                    <Button type="submit" className="flex-1" size="lg" disabled={!chosen || submitting}>
                      {t.submitAnswer}
                    </Button>
                  );
                }
                return (
                  <div className="mt-1 flex gap-2">
                    {prevBtn}
                    {mainBtn}
                    {skipBtn}
                  </div>
                );
              })()}
            </form>
          </CardContent>
        </Card>

        {/* Reveal / explanation */}
        {showReveal && (
          <Card
            className={`border-2 animate-fade-in overflow-hidden ${
              isCorrectChoice ? "border-success/40" : "border-destructive/40"
            }`}
          >
            <div
              className={`px-5 py-4 flex items-start gap-3 ${
                isCorrectChoice ? "bg-success/10" : "bg-destructive/10"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isCorrectChoice ? (
                  <CheckCircle2 className="h-6 w-6 text-success" />
                ) : (
                  <XCircle className="h-6 w-6 text-destructive" />
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <p
                  className={`font-display text-lg font-bold leading-tight ${
                    isCorrectChoice ? "text-success" : "text-destructive"
                  }`}
                >
                  {isCorrectChoice ? t.correct : t.incorrect}
                </p>
                <div className="flex items-start gap-2 flex-wrap">
                  <span className="text-sm text-muted-foreground mt-0.5">{t.correctAnswerLabel}</span>
                  <span className="flex items-start gap-1.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success text-white text-[11px] font-bold mt-0.5">
                      {HEBREW_LETTERS[OPTION_KEYS.indexOf(correctChoice)]}
                    </span>
                    <span className="text-sm font-medium leading-snug">
                      {display[`option${correctChoice}` as "optionA" | "optionB" | "optionC" | "optionD"]}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <CardContent className="pt-5 pb-6 px-6 space-y-5">
              <AnswerExplanation
                explanation={display.answer.explanation}
                evidenceCitations={display.answer.evidenceCitations}
                whyOthersWrong={display.answer.whyOthersWrong}
                correctAnswer={correctChoice}
                options={[
                  { key: "A", text: display.optionA },
                  { key: "B", text: display.optionB },
                  { key: "C", text: display.optionC },
                  { key: "D", text: display.optionD },
                ]}
                insufficientEvidence={display.answer.insufficientEvidence}
                locale={props.contentLocale}
                questionId={display.id}
                highlights={display.highlights}
                highlightT={dict.highlights}
              />

              <Separator className="opacity-50" />

              <ReportAnswerForm
                questionId={display.id}
                labels={{
                  reportButton: t.reportButton,
                  reportPlaceholder: t.reportPlaceholder,
                  sendReport: t.sendReport,
                }}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function BookmarkToggle({
  questionId,
  initialBookmarked,
  labels,
  onChange,
}: {
  questionId: number;
  initialBookmarked: boolean;
  labels: { add: string; remove: string; bookmarked: string; bookmark: string };
  onChange?: (bookmarked: boolean) => void;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [pending, startTransition] = useTransition();

  // Reset when the active question changes.
  useEffect(() => {
    setBookmarked(initialBookmarked);
  }, [questionId, initialBookmarked]);

  function toggle() {
    const optimistic = !bookmarked;
    setBookmarked(optimistic);
    onChange?.(optimistic);
    startTransition(() => {
      toggleBookmarkValueAction(questionId)
        .then((r) => {
          setBookmarked(r.bookmarked);
          onChange?.(r.bookmarked);
        })
        .catch((err) => {
          console.error("[quiz] bookmark toggle failed", err);
          setBookmarked(!optimistic);
          onChange?.(!optimistic);
        });
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      title={bookmarked ? labels.remove : labels.add}
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
        bookmarked
          ? "text-amber-500 hover:text-amber-600"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {bookmarked ? <BookmarkCheck className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
      {bookmarked ? labels.bookmarked : labels.bookmark}
    </button>
  );
}
