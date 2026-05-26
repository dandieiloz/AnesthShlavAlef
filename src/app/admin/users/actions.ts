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
