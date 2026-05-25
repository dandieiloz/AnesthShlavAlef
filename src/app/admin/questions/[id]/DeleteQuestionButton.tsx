"use client";
import { deleteQuestionAction } from "@/app/admin/actions";

export function DeleteQuestionButton({
  questionId,
  chapterNumber,
}: {
  questionId: number;
  chapterNumber: number;
}) {
  async function handleDelete() {
    if (!confirm(`למחוק את שאלה #${questionId}? פעולה זו בלתי הפיכה.`)) return;
    await deleteQuestionAction(questionId);
  }

  return (
    <button
      onClick={handleDelete}
      className="rounded border border-red-300 px-3 py-1 text-sm text-red-600 hover:bg-red-50"
    >
      מחק שאלה
    </button>
  );
}
