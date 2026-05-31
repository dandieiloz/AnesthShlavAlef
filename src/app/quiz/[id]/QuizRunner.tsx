"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  BarChart2,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ClipboardList,
  Flag,
  Loader2,
  XCircle,
} from "lucide-react";
import { AnswerExplanation } from "@/components/AnswerExplanation";
import {
  loadQuizBatchAction,
  recordAttemptAction,
  reportAnswerAction,
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

    if (mode === "immediate") {
      setRevealed(true);
    } else {
      // Full-quiz mode: silently advance without revealing.
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
    setQueue((prev) => prev.slice(1));
    setChosen(null);
    setRevealed(false);
    // Allow the next question to be recorded.
    lastRecordedQuestionId.current = null;
  }

  const display = current;
  const correctChoice = display.answer.correctAnswer;
  const isCorrectChoice = revealed && chosen === correctChoice;
  const showReveal = revealed && mode === "immediate";

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
                const isChosen = chosen === k;
                const isCorrectOption = revealed && k === correctChoice;
                const isWrongChosen = revealed && isChosen && k !== correctChoice;
                const optionText = display[`option${k}` as "optionA" | "optionB" | "optionC" | "optionD"];
                return (
                  <label
                    key={k}
                    className={[
                      "flex items-start gap-3 rounded-lg border p-3.5 text-sm transition-colors",
                      revealed ? "cursor-default" : "cursor-pointer hover:border-primary/40 hover:bg-primary/5",
                      isCorrectOption
                        ? "border-success bg-success/10"
                        : isWrongChosen
                        ? "border-destructive bg-destructive/10"
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
                      onChange={() => !revealed && setChosen(k)}
                      disabled={revealed}
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
                  </label>
                );
              })}

              {!revealed ? (
                <Button type="submit" className="w-full mt-1" size="lg" disabled={!chosen || submitting}>
                  {t.submitAnswer}
                </Button>
              ) : (
                <Button type="button" className="w-full mt-1" size="lg" onClick={handleNext}>
                  {t.nextQuestion}
                </Button>
              )}
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

              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors list-none">
                  <Flag className="h-3.5 w-3.5" />
                  {t.reportButton}
                </summary>
                <form action={reportAnswerAction} className="mt-3 space-y-2">
                  <input type="hidden" name="questionId" value={display.id} />
                  <Textarea
                    name="explanation"
                    required
                    minLength={10}
                    rows={2}
                    placeholder={t.reportPlaceholder}
                    className="text-sm"
                  />
                  <Button variant="outline" size="sm" type="submit" className="gap-2">
                    <Flag className="h-3.5 w-3.5" />
                    {t.sendReport}
                  </Button>
                </form>
              </details>
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
