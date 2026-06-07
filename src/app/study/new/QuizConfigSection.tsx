"use client";
import { useEffect, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlusCircle } from "lucide-react";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { ChapterPicker } from "./ChapterPicker";
import { QuestionLimitPicker } from "./QuestionLimitPicker";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

type StudyNewT = Dictionary["studyNew"];

const MODE_STORAGE_KEY = "quizAnswerMode";
const SETUP_MODE_STORAGE_KEY = "quizSetupMode";
type AnswerMode = "immediate" | "full";
type SetupMode = "chapters" | "exam";

interface ChapterRow {
  id: number;
  number: number;
  title: string;
  learningUsefulnessIndex: number | null;
  questionCount: number;
  totalQuestionCount: number;
  questionCountNonOfficial: number;
  totalQuestionCountNonOfficial: number;
}

export interface ExamYearOption {
  year: number;
  suffix: string;
  total: number;
  remaining: number;
}

function toYearKey(y: ExamYearOption): string {
  return y.suffix ? `${y.year} ${y.suffix}` : `${y.year}`;
}
export interface ExamInstituteOption {
  institute: string;
  years: ExamYearOption[];
}

function buildAutoName(chapters: ChapterRow[], t: StudyNewT): string {
  if (chapters.length === 0) return t.defaultName;
  const sorted = [...chapters].sort((a, b) => a.number - b.number);
  const nums = sorted.map((c) => c.number);
  if (nums.length === 1) return t.singleChapter(nums[0]);
  if (nums.length === 2) return t.twoChapters(nums[0], nums[1]);
  return t.multipleChapters(nums);
}

export function QuizConfigSection({
  chapters,
  preselected = [],
  locale,
  examOptions,
  initialMode = "chapters",
  initialInstitute = null,
  initialYear = null,
}: {
  chapters: ChapterRow[];
  preselected?: number[];
  locale: Locale;
  examOptions: ExamInstituteOption[];
  initialMode?: SetupMode;
  initialInstitute?: string | null;
  initialYear?: string | null;
}) {
  const t = getDictionary(locale).studyNew;
  const tq = getDictionary(locale).quiz;
  const initialSelected = chapters.filter((c) => preselected.includes(c.id));
  const [selectedChapters, setSelectedChapters] = useState<ChapterRow[]>(initialSelected);
  const [nameTouched, setNameTouched] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [mode, setMode] = useState<AnswerMode>("immediate");
  // Exam-by-institution quizzes default to the full exam (include already-seen
  // questions); by-chapter quizzes default to unseen-only.
  const [includeSeen, setIncludeSeen] = useState(initialMode === "exam");
  const [excludeOfficial, setExcludeOfficial] = useState(false);
  const [setupMode, setSetupMode] = useState<SetupMode>(initialMode);

  // Exam-mode selections. Default to URL-provided values if valid, else first option.
  const initialInst = useMemo(() => {
    if (initialInstitute && examOptions.some((e) => e.institute === initialInstitute)) {
      return initialInstitute;
    }
    return examOptions[0]?.institute ?? "";
  }, [examOptions, initialInstitute]);
  const [institute, setInstitute] = useState<string>(initialInst);

  const yearsForInstitute = useMemo(
    () => examOptions.find((e) => e.institute === institute)?.years ?? [],
    [examOptions, institute],
  );
  const initialYrKey = useMemo(() => {
    if (initialYear) {
      const match = yearsForInstitute.find((y) => toYearKey(y) === initialYear);
      if (match) return toYearKey(match);
    }
    return yearsForInstitute[0] ? toYearKey(yearsForInstitute[0]) : null;
  }, [yearsForInstitute, initialYear]);
  const [yearKey, setYearKey] = useState<string | null>(initialYrKey);

  // Keep yearKey valid when institute changes.
  useEffect(() => {
    if (yearsForInstitute.length === 0) {
      setYearKey(null);
      return;
    }
    if (!yearsForInstitute.some((y) => toYearKey(y) === yearKey)) {
      setYearKey(toYearKey(yearsForInstitute[0]));
    }
  }, [yearsForInstitute, yearKey]);

  const displayedChapters = chapters.map((c) => {
    const total = excludeOfficial ? c.totalQuestionCountNonOfficial : c.totalQuestionCount;
    const remaining = excludeOfficial ? c.questionCountNonOfficial : c.questionCount;
    return {
      ...c,
      questionCount: includeSeen ? total : remaining,
    };
  });
  const displayedSelected = selectedChapters.map((c) => {
    const match = displayedChapters.find((x) => x.id === c.id);
    return match ?? c;
  });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === "immediate" || stored === "full") setMode(stored);
      const storedSetup = window.localStorage.getItem(SETUP_MODE_STORAGE_KEY);
      // Only honor stored setup mode if the URL didn't pin one.
      if (
        !initialInstitute &&
        !initialYear &&
        initialMode === "chapters" &&
        (storedSetup === "chapters" || storedSetup === "exam")
      ) {
        setSetupMode(storedSetup);
        setIncludeSeen(storedSetup === "exam");
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function changeMode(next: AnswerMode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function changeSetupMode(next: SetupMode) {
    setSetupMode(next);
    setIncludeSeen(next === "exam");
    try {
      window.localStorage.setItem(SETUP_MODE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const selectedYear = yearsForInstitute.find((y) => toYearKey(y) === yearKey) ?? null;
  const examAvailableCount = selectedYear
    ? includeSeen
      ? selectedYear.total
      : selectedYear.remaining
    : 0;

  const chaptersAvailableCount = displayedSelected.reduce((sum, c) => sum + c.questionCount, 0);
  const availableCount = setupMode === "exam" ? examAvailableCount : chaptersAvailableCount;

  const autoName =
    setupMode === "exam"
      ? institute && yearKey
        ? `${institute} ${yearKey}`
        : t.defaultName
      : buildAutoName(selectedChapters, t);
  const displayName = nameTouched ? nameValue : autoName;

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNameValue(val);
    setNameTouched(val !== "");
  }

  const dir = locale === "he" ? "rtl" : "ltr";
  const hasExamOptions = examOptions.length > 0;

  return (
    <>
      {/* Hidden marker for server action */}
      <input type="hidden" name="mode" value={setupMode} />

      <div className="space-y-1.5">
        <Label>{t.setupMode}</Label>
        <div
          className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs"
          role="group"
          aria-label={t.setupMode}
        >
          <button
            type="button"
            onClick={() => changeSetupMode("chapters")}
            aria-pressed={setupMode === "chapters"}
            className={`rounded px-3 py-1.5 transition-colors ${
              setupMode === "chapters"
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.modeChapters}
          </button>
          <button
            type="button"
            onClick={() => changeSetupMode("exam")}
            disabled={!hasExamOptions}
            aria-pressed={setupMode === "exam"}
            className={`rounded px-3 py-1.5 transition-colors ${
              setupMode === "exam"
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {t.modeExam}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>{t.answerMode}</Label>
        <div
          className="inline-flex rounded-md border bg-muted/40 p-0.5 text-xs"
          role="group"
          aria-label={t.answerMode}
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
            {tq.modeImmediate}
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
            {tq.modeFull}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t.answerModeHint}</p>
      </div>

      {setupMode === "chapters" ? (
        <div className="space-y-2">
          <Label>{t.chooseChapters}</Label>
          <ChapterPicker
            chapters={displayedChapters}
            preselected={preselected}
            onSelectedChaptersChange={(rows) =>
              setSelectedChapters(chapters.filter((c) => rows.some((r) => r.id === c.id)))
            }
            locale={locale}
          />
          <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              name="includeSeen"
              value="1"
              checked={includeSeen}
              onChange={(e) => setIncludeSeen(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input accent-primary"
            />
            <span>
              {locale === "he"
                ? "כלול שאלות שכבר ענית עליהן"
                : "Include questions I've already seen"}
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              name="excludeOfficial"
              value="1"
              checked={excludeOfficial}
              onChange={(e) => setExcludeOfficial(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-input accent-primary"
            />
            <span>
              {locale === "he"
                ? "אל תכלול שאלות ממבחנים רשמיים"
                : "Exclude questions from official exams"}
            </span>
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          {!hasExamOptions ? (
            <p className="text-sm text-muted-foreground">{t.noExamQuestions}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="exam-institute">{t.chooseInstitute}</Label>
                  <SearchableSelect
                    id="exam-institute"
                    name="sourceInstitution"
                    value={institute}
                    onChange={(v) => setInstitute(v)}
                    options={examOptions.map((opt) => ({ value: opt.institute, label: opt.institute }))}
                    placeholder={t.chooseInstitute}
                    searchPlaceholder={t.chooseInstitute}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="exam-year">{t.chooseYear}</Label>
                  <select
                    id="exam-year"
                    name="sourceYear"
                    value={yearKey ?? ""}
                    onChange={(e) => setYearKey(e.target.value)}
                    disabled={yearsForInstitute.length === 0}
                    className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {yearsForInstitute.map((y) => {
                      const key = toYearKey(y);
                      return (
                        <option key={key} value={key}>
                          {y.year}{y.suffix ? ` ${y.suffix}` : ""} ({includeSeen ? y.total : y.remaining})
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 pt-1 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  name="includeSeen"
                  value="1"
                  checked={includeSeen}
                  onChange={(e) => setIncludeSeen(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-input accent-primary"
                />
                <span>
                  {locale === "he"
                    ? "כלול שאלות שכבר ענית עליהן"
                    : "Include questions I've already seen"}
                </span>
              </label>
            </>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label>{t.questionCount}</Label>
        <QuestionLimitPicker
          key={setupMode}
          availableCount={availableCount}
          locale={locale}
          defaultAll={setupMode === "exam"}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quiz-name">{t.quizName}</Label>
        <Input
          id="quiz-name"
          name="name"
          value={displayName}
          onChange={handleNameChange}
          maxLength={200}
          dir={dir}
        />
      </div>

      <Button type="submit" className="w-full gap-2" size="lg" disabled={availableCount === 0}>
        <PlusCircle className="h-4 w-4" />
        {t.createQuiz}
      </Button>
    </>
  );
}

