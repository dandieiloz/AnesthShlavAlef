"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/**
 * Delete the signed-in user's quizzes that were never started (no answers).
 * Nothing else is touched, so no progress can be lost.
 */
export async function deleteUnstartedQuizzesAction(): Promise<number> {
  const me = await requireUser();
  const { count } = await db.quiz.deleteMany({
    where: { userId: me.id, attempts: { none: {} } },
  });
  revalidatePath("/study");
  revalidatePath("/quizzes");
  return count;
}
