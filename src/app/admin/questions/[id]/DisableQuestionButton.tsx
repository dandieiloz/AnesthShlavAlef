"use client";
import { useTransition } from "react";
import { setQuestionDisabledAction } from "@/app/admin/questions/actions";

export function DisableQuestionButton({
  questionId,
  disabled,
}: {
  questionId: number;
  disabled: boolean;
}) {
  const [pending, start] = useTransition();
  const next = !disabled;
  return (
    <button
      onClick={() => {
        if (next && !confirm(`להשבית את שאלה #${questionId}? היא לא תוצג למשתמשים.`)) return;
        start(async () => {
          await setQuestionDisabledAction(questionId, next);
        });
      }}
      disabled={pending}
      className={
        disabled
          ? "rounded border border-emerald-300 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
          : "rounded border border-amber-300 px-3 py-1 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
      }
    >
      {pending ? "..." : disabled ? "הפעל שאלה" : "השבת שאלה"}
    </button>
  );
}
