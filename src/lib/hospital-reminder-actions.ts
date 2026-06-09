"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { HOSPITALS } from "@/lib/hospitals";

const HOSPITAL_SET = new Set<string>(HOSPITALS);

export async function setHospitalAction(hospitalName: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  if (!HOSPITAL_SET.has(hospitalName)) return;
  await db.user.update({
    where: { id: userId },
    data: { hospitalName },
  });
  revalidatePath("/", "layout");
}
