"use client";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ChapterPicker } from "./ChapterPicker";
import { QuestionLimitPicker } from "./QuestionLimitPicker";

interface ChapterRow {
  id: number;
  number: number;
  title: string;
  learningUsefulnessIndex: number | null;
  questionCount: number;
}

function buildAutoName(chapters: ChapterRow[]): string {
  if (chapters.length === 0) return "מבחן שלי";
  const sorted = [...chapters].sort((a, b) => a.number - b.number);
  const nums = sorted.map((c) => c.number);
  if (nums.length === 1) return `פרק ${nums[0]}`;
  if (nums.length === 2) return `פרק ${nums[0]} + פרק ${nums[1]}`;
  return `פרקים ${nums.join(", ")}`;
}

export function QuizConfigSection({
  chapters,
  preselected = [],
}: {
  chapters: ChapterRow[];
  preselected?: number[];
}) {
  const initialSelected = chapters.filter((c) => preselected.includes(c.id));
  const [selectedChapters, setSelectedChapters] = useState<ChapterRow[]>(initialSelected);
  const [nameTouched, setNameTouched] = useState(false);
  const [nameValue, setNameValue] = useState("");

  const availableCount = selectedChapters.reduce((sum, c) => sum + c.questionCount, 0);
  const autoName = buildAutoName(selectedChapters);
  const displayName = nameTouched ? nameValue : autoName;

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setNameValue(val);
    // Clear touch when user empties the field so auto-name resumes
    setNameTouched(val !== "");
  }

  return (
    <>
      <div className="space-y-2">
        <Label>בחרו פרקים</Label>
        <ChapterPicker
          chapters={chapters}
          preselected={preselected}
          onSelectedChaptersChange={setSelectedChapters}
        />
      </div>

      <div className="space-y-2">
        <Label>מספר שאלות למבחן</Label>
        <QuestionLimitPicker availableCount={availableCount} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="quiz-name">שם המבחן</Label>
        <Input
          id="quiz-name"
          name="name"
          value={displayName}
          onChange={handleNameChange}
          maxLength={80}
          dir="rtl"
        />
      </div>
    </>
  );
}
