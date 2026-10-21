"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfileSchema } from "@/app/onboarding/schema";
import { ScheduleSchema } from "@/app/progress/schema";

export async function saveProfileAction(formData: FormData) {
  const me = await requireUser();
  const data = ProfileSchema.parse({
    fullName: formData.get("fullName"),
    hospitalName: formData.get("hospitalName"),
    residencyYear: formData.get("residencyYear"),
    marketingOptIn: formData.get("marketingOptIn"),
  });
  // Optional exam plan: saved only when both fields are present and valid.
  const plan = ScheduleSchema.safeParse({
    examDate: formData.get("examDate") || undefined,
    questionsPerWeek: formData.get("questionsPerWeek") || undefined,
  });
  await db.user.update({
    where: { id: me.id },
    data: {
      ...(plan.success ? { examDate: plan.data.examDate, questionsPerWeek: plan.data.questionsPerWeek } : {}),
      fullName: data.fullName,
      hospitalName: data.hospitalName,
      residencyYear: data.residencyYear,
      marketingOptIn: data.marketingOptIn,
      marketingOptInAt: data.marketingOptIn ? new Date() : null,
    },
  });
  redirect("/study");
}
