"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function batchUpdateSourceAction(ids: number[], source: string | null) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db.question.updateMany({
    where: { id: { in: ids } },
    data: { source: source ?? null },
  });
  revalidatePath("/admin/questions");
}

export async function batchDeleteQuestionsAction(ids: number[]) {
  await requireAdmin();
  if (ids.length === 0) return;
  await db.question.deleteMany({ where: { id: { in: ids } } });
  revalidatePath("/admin/questions");
}
