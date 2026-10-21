"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

/** Weekly target that covers the whole pool by the exam date. */
function suggestPerWeek(examDate: string, poolSize: number): number | null {
  const exam = new Date(examDate + "T00:00:00");
  if (Number.isNaN(exam.getTime())) return null;
  const weeks = Math.max(1, (exam.getTime() - Date.now()) / MS_PER_WEEK);
  return Math.min(500, Math.max(10, Math.ceil(poolSize / weeks)));
}

/**
 * Optional exam date with a suggested weekly target. The target is filled in
 * automatically from the pool size and time left, but stays editable.
 */
export function ExamPlanFields({
  poolSize,
  t,
}: {
  poolSize: number;
  t: { title: string; hint: string; examDate: string; perWeek: string; perWeekHint: string };
}) {
  const [examDate, setExamDate] = useState("");
  const [perWeek, setPerWeek] = useState("");
  const [touched, setTouched] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  function onDateChange(value: string) {
    setExamDate(value);
    if (!touched) {
      const s = value ? suggestPerWeek(value, poolSize) : null;
      setPerWeek(s ? String(s) : "");
    }
  }

  return (
    <fieldset className="space-y-3 rounded-md border p-3">
      <legend className="px-1 text-sm font-medium">{t.title}</legend>
      <p className="text-xs text-muted-foreground">{t.hint}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="examDate">{t.examDate}</Label>
          <Input
            id="examDate"
            name="examDate"
            type="date"
            min={today}
            value={examDate}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="questionsPerWeek">{t.perWeek}</Label>
          <Input
            id="questionsPerWeek"
            name="questionsPerWeek"
            type="number"
            min={1}
            max={500}
            value={perWeek}
            disabled={!examDate}
            onChange={(e) => {
              setTouched(true);
              setPerWeek(e.target.value);
            }}
          />
        </div>
      </div>
      {examDate && <p className="text-xs text-muted-foreground">{t.perWeekHint}</p>}
    </fieldset>
  );
}
