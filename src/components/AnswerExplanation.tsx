import { MathMarkdown } from "@/components/MathMarkdown";
import { HighlightableMarkdown, type HighlightRecord } from "@/components/HighlightableMarkdown";
import { Lightbulb, BookMarked, XCircle, AlertTriangle } from "lucide-react";

const HEBREW_LETTERS: Record<string, string> = { A: "א", B: "ב", C: "ג", D: "ד" };

type Choice = "A" | "B" | "C" | "D";

export type EvidenceCitationDisplay = {
  chapterNumber: number;
  chapterTitle: string;
  sectionPath: string | null;
  quote: string;
  pageStart?: number | null;
  pageEnd?: number | null;
};

type Props = {
  explanation: string;
  evidenceCitations?: EvidenceCitationDisplay[] | null;
  whyOthersWrong: string;
  correctAnswer: Choice;
  options: { key: Choice; text: string }[];
  insufficientEvidence?: boolean;
  locale?: "he" | "en";
  questionId?: number;
  highlights?: HighlightRecord[];
  highlightT?: {
    pickColor: string;
    removeHighlight: string;
    addNote: string;
    editNote: string;
    noteTitle: string;
    notePlaceholder: string;
    saveNote: string;
    clearNote: string;
    staleHighlight: string;
    colorYellow: string;
    colorGreen: string;
    colorPink: string;
    colorBlue: string;
  };
};

const UI = {
  he: {
    insufficient: "הראיות בספר הלימוד אינן מספיקות להוכחה חד-משמעית. ההסבר מבוסס על הנחיות כלליות.",
    explanation: "הסבר",
    whyWrong: "מדוע שאר האפשרויות שגויות",
    evidence: "ראיות מספר הלימוד",
    chapter: "פרק",
    page: "עמ׳",
    pages: "עמ׳׳",
  },
  en: {
    insufficient: "The textbook evidence is insufficient for a definitive proof. The explanation is based on general guidelines.",
    explanation: "Explanation",
    whyWrong: "Why the other options are wrong",
    evidence: "Textbook Evidence",
    chapter: "Chapter",
    page: "p.",
    pages: "pp.",
  },
};

function parseWhyOthersWrong(raw: string): Partial<Record<Choice, string>> {
  const map: Partial<Record<Choice, string>> = {};
  const parts = raw.split(/\n\n(?=[A-D]\.)/);
  for (const part of parts) {
    const m = part.match(/^([A-D])\.\s*([\s\S]+)$/);
    if (m) map[m[1] as Choice] = m[2].trim();
  }
  return map;
}

export function AnswerExplanation({
  explanation,
  evidenceCitations,
  whyOthersWrong,
  correctAnswer,
  options,
  insufficientEvidence,
  locale = "he",
  questionId,
  highlights = [],
  highlightT,
}: Props) {
  const wrongReasons = parseWhyOthersWrong(whyOthersWrong);
  const wrongOptions = options.filter((o) => o.key !== correctAnswer);
  const hasWrongReasons = wrongOptions.some((o) => wrongReasons[o.key]);
  const ui = UI[locale];
  const dir = locale === "en" ? "ltr" : "rtl";

  return (
    <div className="space-y-3 text-sm" dir={dir}>
      {/* Insufficient evidence warning */}
      {insufficientEvidence && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3.5 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            {ui.insufficient}
          </p>
        </div>
      )}

      {/* ── Section 1: Explanation ─────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-sky-400/30 bg-sky-500/[0.04] dark:bg-sky-400/[0.06]">
        <div className="flex items-center gap-2 border-b border-sky-400/25 bg-sky-500/[0.08] dark:bg-sky-400/[0.10] px-4 py-2.5">
          <Lightbulb className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">
            {ui.explanation}
          </span>
        </div>
        <div className="px-4 py-3.5">
          {questionId !== undefined && highlightT ? (
            <HighlightableMarkdown
              text={explanation}
              section="EXPLANATION"
              questionId={questionId}
              locale={locale}
              highlights={highlights}
              t={highlightT}
            />
          ) : (
            <MathMarkdown>{explanation}</MathMarkdown>
          )}
        </div>
      </div>

      {/* ── Section 2: Why other options are wrong ────────────── */}
      {hasWrongReasons && (
        <div className="overflow-hidden rounded-xl border border-rose-400/30 bg-rose-500/[0.03] dark:bg-rose-400/[0.05]">
          <div className="flex items-center gap-2 border-b border-rose-400/25 bg-rose-500/[0.08] dark:bg-rose-400/[0.10] px-4 py-2.5">
            <XCircle className="h-3.5 w-3.5 shrink-0 text-rose-500 dark:text-rose-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-300">
              {ui.whyWrong}
            </span>
          </div>
          <div className="divide-y divide-rose-400/15 px-4">
            {wrongOptions.map(({ key, text }) =>
              wrongReasons[key] ? (
                <div key={key} className="flex items-start gap-3 py-3">
                  {/* Hebrew letter badge */}
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-rose-400/50 bg-rose-500/15 text-[11px] font-bold text-rose-600 dark:text-rose-400">
                    {HEBREW_LETTERS[key]}
                  </span>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Option text (muted) */}
                    <p className="text-[11px] text-muted-foreground/70 leading-snug line-clamp-2">
                      {text}
                    </p>
                    {/* Why wrong */}
                    <div className="text-xs leading-relaxed text-foreground/85">
                      {questionId !== undefined && highlightT ? (
                        <HighlightableMarkdown
                          text={wrongReasons[key]!}
                          section={`WHY_WRONG_${key}`}
                          questionId={questionId}
                          locale={locale}
                          highlights={highlights}
                          t={highlightT}
                        />
                      ) : (
                        <MathMarkdown>{wrongReasons[key]!}</MathMarkdown>
                      )}
                    </div>
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      {/* ── Section 3: Textbook evidence ──────────────────────── */}
      {evidenceCitations && evidenceCitations.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-400/30 bg-amber-400/[0.04] dark:bg-amber-400/[0.06]">
          <div className="flex items-center gap-2 border-b border-amber-400/25 bg-amber-400/[0.10] px-4 py-2.5">
            <BookMarked className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              {ui.evidence}
            </span>
          </div>
          <div className="divide-y divide-amber-400/15 px-4">
            {evidenceCitations.map((e, i) => (
              <div key={i} className="py-3">
                {/* Quote bar + text */}
                <div className="flex items-start gap-3">
                  <div
                    className="mt-1 h-full w-0.5 shrink-0 self-stretch rounded-full bg-amber-400/70"
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="text-xs italic leading-relaxed text-foreground/80">
                      {questionId !== undefined && highlightT ? (
                        <HighlightableMarkdown
                          text={e.quote}
                          section={`EVIDENCE_${i}`}
                          questionId={questionId}
                          locale={locale}
                          highlights={highlights}
                          t={highlightT}
                        />
                      ) : (
                        <p dir="auto" className="text-start [unicode-bidi:plaintext]">
                          &ldquo;{e.quote}&rdquo;
                        </p>
                      )}
                    </div>
                    <p dir="ltr" className="text-[11px] font-medium text-muted-foreground text-left">
                      <span className="[unicode-bidi:isolate]">
                        {ui.chapter} {e.chapterNumber}
                      </span>
                      <span dir="auto" className="text-muted-foreground/70 [unicode-bidi:plaintext]">
                        {" "}
                        — {e.chapterTitle}
                      </span>
                      {e.sectionPath && (
                        <span
                          dir="auto"
                          className="text-muted-foreground/50 [unicode-bidi:plaintext]"
                        >
                          {" "}
                          › {e.sectionPath}
                        </span>
                      )}
                      {e.pageStart != null && (
                        <span className="text-muted-foreground/60 [unicode-bidi:isolate]">
                          {" · "}
                          {e.pageEnd != null && e.pageEnd !== e.pageStart
                            ? `${ui.pages} ${e.pageStart}–${e.pageEnd}`
                            : `${ui.page} ${e.pageStart}`}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
