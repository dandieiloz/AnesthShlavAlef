"use client";
import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChapterPicker } from "./ChapterPicker";
import { QuestionLimitPicker } from "./QuestionLimitPicker";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

type StudyNewT = Dictionary["studyNew"];

const MODE_STORAGE_KEY = "quizAnswerMode";
type AnswerMode = "immediate" | "full";

interface ChapterRow {
  id: number;
  number: number;
  title: string;
  learningUsefulnessIndex: number | null;
  questionCount: number;
  totalQuestionCount: number;
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
}: {
  chapters: ChapterRow[];
  preselected?: number[];
  locale: Locale;
}) {
  const t = getDictionary(locale).studyNew;
  const tq = getDictionary(locale).quiz;
  const initialSelected = chapters.filter((c) => preselected.includes(c.id));
  const [selectedChapters, setSelectedChapters] = useState<ChapterRow[]>(initialSelected);
  const [nameTouched, setNameTouched] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [mode, setMode] = useState<AnswerMode>("immediate");
  const [includeSeen, setIncludeSeen] = useState(false);

  const displayedChapters = chapters.map((c) => ({
    ...c,
    questionCount: includeSeen ? c.totalQuestionCount : c.questionCount,
  }));
  const displayedSelected = selectedChapters.map((c) => {
    const match = displayedChapters.find((x) => x.id === c.id);
    return match ?? c;
  });

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(MODE_STORAGE_KEY);
      if (stored === "immediate" || stored === "full") setMode(stored);
    } catch {
      /* ignore */
    }
  }, []);

  function changeMode(next: AnswerMode) {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
  }

  const availableCount = displayedSelected.reduce((sum, c) => sum + c.questionCount, 0);
  const autoName = buildAutoName(selectedChapters, t);
  const displayName = nameTouched ? nameValue : autoName;

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNameValue(val);
    setNameTouched(val !== "");
  }

  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <>
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
      </div>

      <div className="space-y-2">
        <Label>{t.questionCount}</Label>
        <QuestionLimitPicker availableCount={availableCount} locale={locale} />
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
    </>
  );
}
