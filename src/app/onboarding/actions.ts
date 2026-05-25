"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileSchema } from "@/app/onboarding/schema";

export async function saveProfileAction(formData: FormData) {
  const me = await requireUser();
  const data = ProfileSchema.parse({
    fullName: formData.get("fullName"),
    hospitalName: formData.get("hospitalName"),
    residencyYear: formData.get("residencyYear"),
  });
  await db.user.update({
    where: { id: me.id },
    data,
  });
  redirect("/study");
}
