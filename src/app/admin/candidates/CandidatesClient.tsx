"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import {
  acceptCandidateAction,
  discardCandidateAction,
  acceptAllCandidatesAction,
  discardAllCandidatesAction,
} from "./actions";

type Choice = "A" | "B" | "C" | "D";

type AnswerPanel = {
  correctAnswer: Choice;
  explanation: string;
  whyOthersWrong: string;
  evidenceCitations: EvidenceCitationDisplay[];
  insufficientEvidence: boolean;
  confidence: number | null;
};

export type CandidateRow = {
  questionId: number;
  generatedAt: string;
  hint: string | null;
  stem: string;
  source: string | null;
  chapterNumber: number;
  chapterTitle: string;
  options: { key: Choice; text: string }[];
  candidate: AnswerPanel & { model: string };
  current: AnswerPanel | null;
};

function formatPct(c: number | null | undefined): string {
  if (c === null || c === undefined) return "—";
  return `${Math.round(c * 100)}%`;
}

export function CandidatesClient({ rows }: { rows: CandidateRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<number>>(new Set(rows.slice(0, 1).map((r) => r.questionId)));
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const unchangedIds = rows
    .filter((r) => r.current && r.current.correctAnswer === r.candidate.correctAnswer)
    .map((r) => r.questionId);

  function toggle(qid: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }

  function toggleSelected(qid: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }

  function selectUnchanged() {
    setSelected(new Set(unchangedIds));
  }

  function selectAllRows() {
    setSelected(new Set(rows.map((r) => r.questionId)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function acceptSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`לאשר ${ids.length} מועמדים נבחרים? פעולה זו תחליף את התשובות הקיימות.`)) return;
    setError(null);
    startTransition(async () => {
      await acceptAllCandidatesAction(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  function discardSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!confirm(`להשליך ${ids.length} מועמדים נבחרים?`)) return;
    setError(null);
    startTransition(async () => {
      await discardAllCandidatesAction(ids);
      setSelected(new Set());
      router.refresh();
    });
  }

  function accept(qid: number) {
    setError(null);
    setBusyId(qid);
    startTransition(async () => {
      const r = await acceptCandidateAction(qid);
      setBusyId(null);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function discard(qid: number) {
    setError(null);
    setBusyId(qid);
    startTransition(async () => {
      const r = await discardCandidateAction(qid);
      setBusyId(null);
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function acceptAll() {
    if (!confirm(`לאשר את כל ${rows.length} המועמדים? פעולה זו תחליף את התשובות הקיימות.`)) return;
    setError(null);
    startTransition(async () => {
      await acceptAllCandidatesAction(rows.map((r) => r.questionId));
      router.refresh();
    });
  }

  function discardAll() {
    if (!confirm(`להשליך את כל ${rows.length} המועמדים?`)) return;
    setError(null);
    startTransition(async () => {
      await discardAllCandidatesAction(rows.map((r) => r.questionId));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="sticky top-0 z-10 space-y-2 rounded border bg-card p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-medium">
            {rows.length} מועמדים ממתינים
            {selected.size > 0 && (
              <span className="ms-2 text-emerald-700 dark:text-emerald-300">
                · {selected.size} נבחרו
              </span>
            )}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={acceptAll}
              disabled={pending}
              className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              אשר הכל
            </button>
            <button
              onClick={discardAll}
              disabled={pending}
              className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
            >
              השלך הכל
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
          <span className="text-muted-foreground">בחירה מהירה:</span>
          <button
            onClick={selectUnchanged}
            disabled={pending || unchangedIds.length === 0}
            className="rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-emerald-800 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200"
            title="בחר את כל המועמדים שבהם התשובה הנכונה לא השתנתה — בטוח לאשר ללא בדיקה ידנית"
          >
            תשובה לא השתנתה ({unchangedIds.length})
          </button>
          <button
            onClick={selectAllRows}
            disabled={pending}
            className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
          >
            בחר הכל
          </button>
          <button
            onClick={clearSelection}
            disabled={pending || selected.size === 0}
            className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
          >
            נקה בחירה
          </button>
          <div className="flex-1" />
          <button
            onClick={acceptSelected}
            disabled={pending || selected.size === 0}
            className="rounded bg-emerald-600 px-3 py-1 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            אשר נבחרים ({selected.size})
          </button>
          <button
            onClick={discardSelected}
            disabled={pending || selected.size === 0}
            className="rounded border border-red-300 px-3 py-1 font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
          >
            השלך נבחרים
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {rows.map((r) => {
        const isOpen = expanded.has(r.questionId);
        const isBusy = busyId === r.questionId && pending;
        const isSelected = selected.has(r.questionId);
        const answerChanged = !!r.current && r.current.correctAnswer !== r.candidate.correctAnswer;
        return (
          <article
            key={r.questionId}
            id={`q-${r.questionId}`}
            className={`rounded border bg-card ${isSelected ? "ring-2 ring-emerald-400" : ""}`}
          >
            <header className="flex flex-wrap items-start gap-3 p-3">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelected(r.questionId)}
                disabled={pending}
                className="mt-1 h-4 w-4 cursor-pointer"
                aria-label={`בחר שאלה ${r.questionId}`}
              />
              <button
                onClick={() => toggle(r.questionId)}
                className="text-start flex-1 hover:opacity-80"
              >
                <div className="text-xs text-muted-foreground">
                  שאלה #{r.questionId} · פרק {r.chapterNumber} — {r.chapterTitle}
                  {r.source && <span> · {r.source}</span>}
                  <span> · נוצר {new Date(r.generatedAt).toLocaleString("he-IL")}</span>
                </div>
                <div className="mt-1 line-clamp-2 text-sm">{r.stem}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-muted px-2 py-0.5">
                    קיים: {r.current?.correctAnswer ?? "—"} ({formatPct(r.current?.confidence)})
                  </span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    חדש: {r.candidate.correctAnswer} ({formatPct(r.candidate.confidence)})
                  </span>
                  {answerChanged ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                      תשובה השתנתה
                    </span>
                  ) : r.current ? (
                    <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      תשובה זהה
                    </span>
                  ) : null}
                  {r.hint && (
                    <span className="rounded bg-purple-100 px-2 py-0.5 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200">
                      רמז שימש בחילול
                    </span>
                  )}
                </div>
              </button>
              <div className="flex shrink-0 gap-2">
                <Link
                  href={`/admin/questions/${r.questionId}`}
                  className="rounded border px-3 py-1.5 text-sm hover:bg-muted"
                >
                  פתח שאלה
                </Link>
                <button
                  onClick={() => accept(r.questionId)}
                  disabled={pending}
                  className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isBusy ? "..." : "אשר"}
                </button>
                <button
                  onClick={() => discard(r.questionId)}
                  disabled={pending}
                  className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                >
                  {isBusy ? "..." : "השלך"}
                </button>
              </div>
            </header>

            {isOpen && (
              <div className="border-t p-3 space-y-3">
                {r.hint && (
                  <div className="rounded border border-purple-300 bg-purple-50 p-2 text-sm dark:bg-purple-950/30">
                    <div className="text-xs font-semibold text-purple-800 dark:text-purple-300">
                      רמז שניתן למודל:
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-purple-900 dark:text-purple-200">
                      {r.hint}
                    </div>
                  </div>
                )}
                <div className="grid gap-4 lg:grid-cols-2">
                  <section className="rounded border bg-background p-3">
                    <h3 className="mb-2 text-sm font-semibold text-muted-foreground">
                      תשובה קיימת
                    </h3>
                    {r.current ? (
                      <AnswerExplanation
                        explanation={r.current.explanation}
                        evidenceCitations={r.current.evidenceCitations}
                        whyOthersWrong={r.current.whyOthersWrong}
                        correctAnswer={r.current.correctAnswer}
                        options={r.options}
                        insufficientEvidence={r.current.insufficientEvidence}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">אין תשובה קיימת.</p>
                    )}
                  </section>
                  <section className="rounded border-2 border-emerald-300 bg-emerald-50/30 p-3 dark:border-emerald-800 dark:bg-emerald-950/20">
                    <h3 className="mb-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      חילול חדש (מועמד)
                    </h3>
                    <AnswerExplanation
                      explanation={r.candidate.explanation}
                      evidenceCitations={r.candidate.evidenceCitations}
                      whyOthersWrong={r.candidate.whyOthersWrong}
                      correctAnswer={r.candidate.correctAnswer}
                      options={r.options}
                      insufficientEvidence={r.candidate.insufficientEvidence}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      מודל: {r.candidate.model}
                    </p>
                  </section>
                </div>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
