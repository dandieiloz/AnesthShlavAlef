"use client";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChapterPicker } from "./ChapterPicker";
import { QuestionLimitPicker } from "./QuestionLimitPicker";
import { getDictionary, type Dictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

type StudyNewT = Dictionary["studyNew"];

interface ChapterRow {
  id: number;
  number: number;
  title: string;
  learningUsefulnessIndex: number | null;
  questionCount: number;
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
  const initialSelected = chapters.filter((c) => preselected.includes(c.id));
  const [selectedChapters, setSelectedChapters] = useState<ChapterRow[]>(initialSelected);
  const [nameTouched, setNameTouched] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const availableCount = selectedChapters.reduce((sum, c) => sum + c.questionCount, 0);
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
          chapters={chapters}
          preselected={preselected}
          onSelectedChaptersChange={setSelectedChapters}
          locale={locale}
        />
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
          maxLength={80}
          dir={dir}
        />
      </div>
    </>
  );
}
