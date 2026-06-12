"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { MathMarkdown } from "@/components/MathMarkdown";
import { HighlightableMarkdown, type HighlightRecord } from "@/components/HighlightableMarkdown";
import { CitationPageLink } from "@/components/CitationPageLink";
import { QuestionImage } from "@/components/QuestionImage";
import { BookMarked, XCircle, AlertTriangle, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

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
  /** Additional choices an admin has marked as also accepted (excludes the primary `correctAnswer`). */
  acceptedAnswers?: Choice[];
  /** The choice the user actually submitted, used to decide whether to render the "also accepted" banner. */
  userChoice?: Choice;
  options: { key: Choice; text: string }[];
  insufficientEvidence?: boolean;
  /** Optional image an admin manually attached to the explanation; shown in the correct-answer card. */
  explanationImageUrl?: string | null;
  explanationImageAlt?: string | null;
  locale?: "he" | "en";
  questionId?: number;
  highlights?: HighlightRecord[];
  /**
   * When true, each answer/evidence section is collapsible and only sections
   * that contain a saved highlight start expanded. Used on the bookmarks page
   * so highlighted sentences surface inside their original section. Defaults to
   * false, preserving the always-expanded layout everywhere else.
   */
  collapsibleSections?: boolean;
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
    alsoAccepted: "תשובה זו מתקבלת גם היא כתשובה נכונה. התשובה הראשית מוצגת למטה.",
    correctLabel: "תשובה נכונה",
    acceptedLabel: "מתקבלת גם",
    wrongLabel: "שגוי",
    evidence: "ראיות מספר הלימוד",
    chapter: "פרק",
    page: "עמ׳",
    pages: "עמ׳׳",
    citationNotConfigured: "לא הוגדר קובץ PDF.",
    citationSetup: "הגדירו עכשיו",
    citationPermissionDenied: "גישה נדחתה",
    citationNotFound: "הקובץ לא נמצא",
  },
  en: {
    insufficient: "The textbook evidence is insufficient for a definitive proof. The explanation is based on general guidelines.",
    alsoAccepted: "This answer is also accepted. The explanation below refers to the primary answer.",
    correctLabel: "Correct answer",
    acceptedLabel: "Also accepted",
    wrongLabel: "Incorrect",
    evidence: "Textbook Evidence",
    chapter: "Chapter",
    page: "p.",
    pages: "pp.",
    citationNotConfigured: "No PDF set.",
    citationSetup: "Set it up",
    citationPermissionDenied: "Access denied",
    citationNotFound: "File not found",
  },
};

const PDF_SETUP_HREF = "/profile?tab=settings#local-pdf";

function parseWhyOthersWrong(raw: string): Partial<Record<Choice, string>> {
  const map: Partial<Record<Choice, string>> = {};
  // Split before each `A.`/`B.`/`C.`/`D.` marker that starts a line. We accept a
  // single newline (not only a blank line) so sections that were stored without
  // a blank-line separator still break into their own per-option cards.
  const parts = raw.split(/\n+(?=[A-D]\.\s)/);
  for (const part of parts) {
    const m = part.match(/^([A-D])\.\s*([\s\S]+)$/);
    if (m) map[m[1] as Choice] = m[2].trim();
  }
  return map;
}

/**
 * Replace inline `[N]` citation markers with clickable anchor links to the
 * matching numbered citation in the evidence section. Math regions (`$...$`,
 * `$$...$$`) are skipped so LaTeX brackets are not mangled. Markers that don't
 * point to a real citation index are left as plain text.
 */
function injectCitationAnchors(
  text: string,
  questionId: number | undefined,
  citationCount: number,
): string {
  if (questionId === undefined || citationCount === 0 || !text) return text;
  const linkFor = (n: string): string | null => {
    const num = parseInt(n, 10);
    if (num < 1 || num > citationCount) return null;
    return `[${n}](#cite-${questionId}-${num})`;
  };
  const parts = text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g);
  return parts
    .map((part, idx) => {
      if (idx % 2 === 1) return part;
      // Single `[N]` and multi-number `[1, 2]` / `[2,1]` markers. Each number is
      // linkified independently; out-of-range numbers stay as plain text so a
      // mistyped reference never breaks the surrounding markup.
      return part.replace(/(?<!\[)\[\s*\d+(?:\s*,\s*\d+)*\s*\](?!\()/g, (m) => {
        const nums = m.replace(/[[\]\s]/g, "").split(",").filter(Boolean);
        let anyLinked = false;
        const out = nums
          .map((n) => {
            const link = linkFor(n);
            if (link) anyLinked = true;
            return link ?? `[${n}]`;
          })
          .join("");
        return anyLinked ? out : m;
      });
    })
    .join("");
}

type Palette = {
  border: string;
  bg: string;
  headerBg: string;
  headerBorder: string;
  badge: string;
  iconClass: string;
  label: string;
};

const PALETTES: Record<"correct" | "wrong", Palette> = {
  correct: {
    border: "border-emerald-400/30",
    bg: "bg-emerald-500/[0.04] dark:bg-emerald-400/[0.06]",
    headerBg: "bg-emerald-500/[0.10] dark:bg-emerald-400/[0.12]",
    headerBorder: "border-emerald-400/25",
    badge: "border-emerald-400/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    label: "text-emerald-700 dark:text-emerald-300",
  },
  wrong: {
    border: "border-rose-400/30",
    bg: "bg-rose-500/[0.03] dark:bg-rose-400/[0.05]",
    headerBg: "bg-rose-500/[0.08] dark:bg-rose-400/[0.10]",
    headerBorder: "border-rose-400/25",
    badge: "border-rose-400/50 bg-rose-500/15 text-rose-600 dark:text-rose-400",
    iconClass: "text-rose-500 dark:text-rose-400",
    label: "text-rose-700 dark:text-rose-300",
  },
};

export function AnswerExplanation({
  explanation,
  evidenceCitations,
  whyOthersWrong,
  correctAnswer,
  acceptedAnswers,
  userChoice,
  options,
  insufficientEvidence,
  explanationImageUrl,
  explanationImageAlt,
  locale = "he",
  questionId,
  highlights = [],
  collapsibleSections = false,
  highlightT,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Smooth-scroll + flash when an inline [N] anchor is clicked.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest('a[href*="#cite-"]') as HTMLAnchorElement | null;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      const hashIdx = href.indexOf("#");
      if (hashIdx < 0) return;
      const id = href.slice(hashIdx + 1);
      if (!id.startsWith("cite-")) return;
      const targetEl = document.getElementById(id);
      if (!targetEl) return;
      ev.preventDefault();
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      targetEl.classList.add("cite-flash");
      window.setTimeout(() => targetEl.classList.remove("cite-flash"), 1400);
    };
    el.addEventListener("click", handler);
    return () => el.removeEventListener("click", handler);
  }, []);

  // Hover preview state for the inline citation hovercard.
  const [preview, setPreview] = useState<{ idx: number; rect: DOMRect } | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const cancelHide = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };
  const scheduleHide = () => {
    cancelHide();
    hideTimerRef.current = window.setTimeout(() => {
      setPreview(null);
      hideTimerRef.current = null;
    }, 140);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !evidenceCitations || evidenceCitations.length === 0) return;
    const findIdx = (anchor: HTMLAnchorElement): number | null => {
      const href = anchor.getAttribute("href") || "";
      const m = href.match(/#cite-\d+-(\d+)/);
      if (!m) return null;
      const num = parseInt(m[1], 10);
      if (num < 1 || num > evidenceCitations.length) return null;
      return num - 1;
    };
    const onOver = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest('a[href*="#cite-"]') as HTMLAnchorElement | null;
      if (!link) return;
      const idx = findIdx(link);
      if (idx === null) return;
      cancelHide();
      setPreview({ idx, rect: link.getBoundingClientRect() });
    };
    const onOut = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest('a[href*="#cite-"]') as HTMLAnchorElement | null;
      if (!link) return;
      const related = ev.relatedTarget as HTMLElement | null;
      if (related && related.closest("[data-cite-preview]")) return;
      scheduleHide();
    };
    el.addEventListener("mouseover", onOver);
    el.addEventListener("mouseout", onOut);
    return () => {
      el.removeEventListener("mouseover", onOver);
      el.removeEventListener("mouseout", onOut);
      cancelHide();
    };
  }, [evidenceCitations]);

  // Close preview on scroll/resize so it never floats away from its anchor.
  useEffect(() => {
    if (!preview) return;
    const close = () => setPreview(null);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [preview]);

  const wrongReasons = parseWhyOthersWrong(whyOthersWrong);
  const acceptedSet = new Set<Choice>(acceptedAnswers ?? []);
  const showAlsoAcceptedBanner =
    userChoice !== undefined &&
    userChoice !== correctAnswer &&
    acceptedSet.has(userChoice);
  const ui = UI[locale];
  const dir = locale === "en" ? "ltr" : "rtl";
  const citationCount = evidenceCitations?.length ?? 0;

  // Sections that start expanded when `collapsibleSections` is on: any section
  // the user has highlighted in. Evidence quotes use `EVIDENCE_<n>` section
  // names but share a single collapsible block keyed "EVIDENCE".
  const initiallyOpenSections = useMemo(() => {
    const open = new Set<string>();
    for (const h of highlights) {
      open.add(h.section.startsWith("EVIDENCE_") ? "EVIDENCE" : h.section);
    }
    return open;
  }, [highlights]);
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(initiallyOpenSections),
  );
  const isSectionOpen = (name: string) =>
    !collapsibleSections || openSections.has(name);
  const toggleSection = (name: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div ref={containerRef} className="space-y-3 text-sm" dir={dir}>
      {/* Insufficient evidence warning */}
      {insufficientEvidence && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/50 bg-amber-400/10 px-3.5 py-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            {ui.insufficient}
          </p>
        </div>
      )}

      {/* Also-accepted banner: shown when the user picked a non-primary answer
          that the admin has marked as additionally accepted. */}
      {showAlsoAcceptedBanner && (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-400/50 bg-emerald-400/10 px-3.5 py-3">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-300">
            {ui.alsoAccepted}
          </p>
        </div>
      )}

      {/* ── Per-answer cards: correct + accepted first, then wrong answers in original order ──
          Force RTL so the answers and the detailed explanation stay right-aligned even when the
          content (or a sentence) starts with a Latin term. The textbook-evidence block below is
          intentionally excluded and keeps the container direction. */}
      <div className="answers-rtl space-y-2" dir="rtl">
        {[...options]
          .sort((a, b) => {
            const rank = (k: Choice) =>
              k === correctAnswer ? 0 : acceptedSet.has(k) ? 1 : 2;
            const ra = rank(a.key);
            const rb = rank(b.key);
            if (ra !== rb) return ra - rb;
            return options.findIndex((o) => o.key === a.key) -
              options.findIndex((o) => o.key === b.key);
          })
          .map(({ key, text }) => {
          const isCorrect = key === correctAnswer;
          const isAlsoAccepted = !isCorrect && acceptedSet.has(key);
          const wrongReasonText =
            !isCorrect && !isAlsoAccepted ? wrongReasons[key] : undefined;
          const isWrong = !isCorrect && !isAlsoAccepted;

          // Skip wrong cards with no reasoning so we don't render empty boxes.
          if (isWrong && !wrongReasonText) return null;

          const palette = isWrong ? PALETTES.wrong : PALETTES.correct;
          const Icon = isWrong ? XCircle : CheckCircle2;
          const headerLabel = isCorrect
            ? ui.correctLabel
            : isAlsoAccepted
              ? ui.acceptedLabel
              : ui.wrongLabel;

          const rawBody = isCorrect ? explanation : wrongReasonText ?? "";
          const bodyText = injectCitationAnchors(rawBody, questionId, citationCount);
          const sectionName = isCorrect ? "EXPLANATION" : `WHY_WRONG_${key}`;
          const hasBody = bodyText.length > 0;
          const open = isSectionOpen(sectionName);

          return (
            <div
              key={key}
              className={cn(
                "rounded-xl border",
                palette.border,
                palette.bg,
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-2.5 px-4 py-2.5",
                  open && "rounded-t-xl border-b",
                  palette.headerBorder,
                  palette.headerBg,
                )}
                {...(collapsibleSections
                  ? {
                      role: "button" as const,
                      tabIndex: 0,
                      onClick: () => toggleSection(sectionName),
                      onKeyDown: (e: ReactKeyboardEvent) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleSection(sectionName);
                        }
                      },
                    }
                  : {})}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                    palette.badge,
                  )}
                >
                  {HEBREW_LETTERS[key]}
                </span>
                <Icon className={cn("h-3.5 w-3.5 shrink-0", palette.iconClass)} />
                <span
                  className={cn(
                    "text-[11px] font-bold uppercase tracking-widest",
                    palette.label,
                  )}
                >
                  {headerLabel}
                </span>
                {collapsibleSections && (
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 shrink-0 transition-transform ms-auto text-muted-foreground",
                      open && "rotate-180",
                    )}
                  />
                )}
              </div>
              {open && (
                <div className="px-4 py-3 space-y-2">
                  <p className="text-[11px] leading-snug text-muted-foreground/85">
                    {text}
                  </p>
                  {hasBody && (
                    <div className="text-foreground/90">
                      {questionId !== undefined && highlightT ? (
                        <HighlightableMarkdown
                          text={bodyText}
                          section={sectionName}
                          questionId={questionId}
                          locale={locale}
                          highlights={highlights}
                          t={highlightT}
                        />
                      ) : (
                        <MathMarkdown>{bodyText}</MathMarkdown>
                      )}
                    </div>
                  )}
                  {isCorrect && explanationImageUrl && (
                    <QuestionImage url={explanationImageUrl} alt={explanationImageAlt} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Numbered textbook evidence ────────────────────────── */}
      {evidenceCitations && evidenceCitations.length > 0 && (
        <div className="rounded-xl border border-amber-400/30 bg-amber-400/[0.04] dark:bg-amber-400/[0.06]">
          <div
            className={cn(
              "flex items-center gap-2 px-4 py-2.5",
              isSectionOpen("EVIDENCE") && "rounded-t-xl border-b border-amber-400/25",
              "bg-amber-400/[0.10]",
            )}
            {...(collapsibleSections
              ? {
                  role: "button" as const,
                  tabIndex: 0,
                  onClick: () => toggleSection("EVIDENCE"),
                  onKeyDown: (e: ReactKeyboardEvent) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSection("EVIDENCE");
                    }
                  },
                }
              : {})}
          >
            <BookMarked className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              {ui.evidence}
            </span>
            {collapsibleSections && (
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform ms-auto text-amber-600/80 dark:text-amber-400/80",
                  isSectionOpen("EVIDENCE") && "rotate-180",
                )}
              />
            )}
          </div>
          {isSectionOpen("EVIDENCE") && (
          <div className="divide-y divide-amber-400/15 px-4">
            {evidenceCitations.map((e, i) => {
              const num = i + 1;
              const id =
                questionId !== undefined ? `cite-${questionId}-${num}` : undefined;
              return (
                <div
                  key={i}
                  id={id}
                  className="-mx-4 scroll-mt-24 rounded-lg px-4 py-3 transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/50 bg-amber-400/15 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                      {num}
                    </span>
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
                            <CitationPageLink
                              page={e.pageStart}
                              notConfiguredLabel={ui.citationNotConfigured}
                              permissionDeniedLabel={ui.citationPermissionDenied}
                              notFoundLabel={ui.citationNotFound}
                              setupHref={PDF_SETUP_HREF}
                              setupLabel={ui.citationSetup}
                            >
                              {e.pageEnd != null && e.pageEnd !== e.pageStart
                                ? `${ui.pages} ${e.pageStart}–${e.pageEnd}`
                                : `${ui.page} ${e.pageStart}`}
                            </CitationPageLink>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Inline hovercard rendered when the user mouses over a [N] citation marker. */}
      {preview && evidenceCitations && evidenceCitations[preview.idx] && (
        <CitePreviewCard
          citation={evidenceCitations[preview.idx]}
          num={preview.idx + 1}
          anchorRect={preview.rect}
          isRtl={dir === "rtl"}
          ui={ui}
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        />
      )}
    </div>
  );
}

function CitePreviewCard({
  citation,
  num,
  anchorRect,
  isRtl,
  ui,
  onMouseEnter,
  onMouseLeave,
}: {
  citation: EvidenceCitationDisplay;
  num: number;
  anchorRect: DOMRect;
  isRtl: boolean;
  ui: (typeof UI)["he"];
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const cardEl = ref.current;
    if (!cardEl) return;
    const cardRect = cardEl.getBoundingClientRect();
    const cardW = cardRect.width || 320;
    const cardH = cardRect.height || 160;
    const margin = 8;

    let left = isRtl ? anchorRect.right - cardW : anchorRect.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - cardW - margin));

    const spaceBelow = window.innerHeight - anchorRect.bottom;
    const flipUp = spaceBelow < cardH + margin && anchorRect.top > cardH + margin;
    const top = flipUp ? anchorRect.top - cardH - 6 : anchorRect.bottom + 6;

    setPos({ top, left });
  }, [anchorRect, isRtl]);

  return (
    <div
      ref={ref}
      data-cite-preview
      dir={isRtl ? "rtl" : "ltr"}
      className="fixed z-50 w-[320px] max-w-[calc(100vw-1rem)] overflow-hidden rounded-xl border border-amber-400/50 bg-popover shadow-lg ring-1 ring-amber-400/15"
      style={{
        top: pos?.top ?? anchorRect.bottom + 6,
        left: pos?.left ?? Math.max(8, anchorRect.left),
        opacity: pos ? 1 : 0,
        transition: "opacity 100ms ease-out",
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div className="flex items-center gap-2 border-b border-amber-400/25 bg-amber-400/[0.10] px-3 py-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-400/50 bg-amber-400/15 text-[10px] font-bold text-amber-700 dark:text-amber-300">
          {num}
        </span>
        <span
          dir="auto"
          className="min-w-0 truncate text-[11px] font-medium text-amber-700 dark:text-amber-300 [unicode-bidi:plaintext]"
        >
          {ui.chapter} {citation.chapterNumber} — {citation.chapterTitle}
        </span>
      </div>
      <div className="space-y-1.5 px-3 py-2.5">
        <p
          dir="auto"
          className="line-clamp-6 text-xs italic leading-relaxed text-foreground/85 [unicode-bidi:plaintext]"
        >
          &ldquo;{citation.quote}&rdquo;
        </p>
        {(citation.sectionPath || citation.pageStart != null) && (
          <p
            dir="ltr"
            className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-left text-[11px] font-medium text-muted-foreground"
          >
            {citation.sectionPath && (
              <span
                dir="auto"
                className="min-w-0 truncate text-muted-foreground/70 [unicode-bidi:plaintext]"
              >
                › {citation.sectionPath}
              </span>
            )}
            {citation.pageStart != null && (
              <span className="text-muted-foreground/80 [unicode-bidi:isolate]">
                <CitationPageLink
                  page={citation.pageStart}
                  notConfiguredLabel={ui.citationNotConfigured}
                  permissionDeniedLabel={ui.citationPermissionDenied}
                  notFoundLabel={ui.citationNotFound}
                  setupHref={PDF_SETUP_HREF}
                  setupLabel={ui.citationSetup}
                >
                  {citation.pageEnd != null && citation.pageEnd !== citation.pageStart
                    ? `${ui.pages} ${citation.pageStart}–${citation.pageEnd}`
                    : `${ui.page} ${citation.pageStart}`}
                </CitationPageLink>
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
