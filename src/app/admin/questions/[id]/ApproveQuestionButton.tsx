"use client";
import { useTransition } from "react";
import { setQuestionAdminApprovedAction } from "@/app/admin/questions/actions";

export function ApproveQuestionButton({
  questionId,
  approved,
  insufficientEvidence,
}: {
  questionId: number;
  approved: boolean;
  insufficientEvidence?: boolean;
}) {
  const [pending, start] = useTransition();
  const next = !approved;
  return (
    <button
      onClick={() => {
        if (next) {
          const warn = insufficientEvidence
            ? `שים לב: המודל סימן את השאלה כ"ראיות חסרות". לאשר ידנית את שאלה #${questionId} ולהציג אותה למשתמשים בכל מקרה? פעולה זו עוקפת את סף הביטחון.`
            : `לאשר ידנית את שאלה #${questionId}? היא תוצג למשתמשים גם אם ביטחון ההסבר נמוך מהסף.`;
          if (!confirm(warn)) return;
        }
        start(async () => {
          await setQuestionAdminApprovedAction(questionId, next);
        });
      }}
      disabled={pending}
      className={
        approved
          ? "rounded border border-amber-300 px-3 py-1 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          : "rounded border border-emerald-300 px-3 py-1 text-sm text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
      }
    >
      {pending ? "..." : approved ? "בטל אישור ידני" : "אשר ידנית (פרסם)"}
    </button>
  );
}
