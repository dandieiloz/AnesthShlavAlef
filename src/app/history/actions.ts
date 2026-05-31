"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";

/**
 * Reset history for the signed-in user on the given questions by deleting their
 * Attempt rows. Scoped to the caller — never touches other users' attempts.
 * Returns the number of attempt rows deleted.
 */
export async function resetQuestionHistoryAction(questionIds: number[]): Promise<number> {
  const me = await requireCompletedProfile();
  const ids = questionIds.filter((n) => Number.isFinite(n) && n > 0);
  if (ids.length === 0) return 0;

  const { count } = await db.attempt.deleteMany({
    where: { userId: me.id, questionId: { in: ids } },
  });

  revalidatePath("/history");
  return count;
}
