"use server";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ScheduleSchema } from "./schema";

export async function saveScheduleAction(formData: FormData) {
  const me = await requireUser();
  const data = ScheduleSchema.parse({
    examDate: formData.get("examDate"),
    questionsPerWeek: formData.get("questionsPerWeek"),
  });
  await db.user.update({
    where: { id: me.id },
    data,
  });
  revalidatePath("/schedule");
}
