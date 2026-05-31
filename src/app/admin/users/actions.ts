"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function setUserRoleAction(userId: string, newRole: "USER" | "ADMIN") {
  const me = await requireAdmin();
  if (userId === me.id) {
    throw new Error("לא ניתן לשנות את תפקידך שלך");
  }
  await db.user.update({
    where: { id: userId },
    data: { role: newRole },
  });
  revalidatePath("/admin/users");
}

export async function setUserPlanAction(userId: string, newPlan: "DEMO" | "PAID") {
  const me = await requireAdmin();
  if (userId === me.id) {
    throw new Error("לא ניתן לשנות את התוכנית שלך");
  }
  await db.user.update({
    where: { id: userId },
    data: { plan: newPlan },
  });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(userId: string) {
  const me = await requireAdmin();
  if (userId === me.id) {
    throw new Error("לא ניתן למחוק את עצמך");
  }
  // Null out non-cascading references so the delete can proceed.
  await db.$transaction([
    db.question.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
    db.answerReport.updateMany({ where: { resolvedById: userId }, data: { resolvedById: null } }),
    db.answerGenerationJob.updateMany({ where: { createdById: userId }, data: { createdById: null } }),
    db.user.delete({ where: { id: userId } }),
  ]);
  revalidatePath("/admin/users");
}
