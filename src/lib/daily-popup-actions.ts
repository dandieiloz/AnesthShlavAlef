"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function markDailyPopupShown(): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  await db.user.update({
    where: { id: userId },
    data: { lastDailyPopupAt: new Date() },
  });
}

export async function acknowledgeDailyPopup(popupId: string): Promise<void> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId || !popupId) return;
  const now = new Date();
  await db.$transaction([
    db.dailyPopupAck.upsert({
      where: { userId_popupId: { userId, popupId } },
      update: { acknowledgedAt: now },
      create: { userId, popupId, acknowledgedAt: now },
    }),
    db.user.update({
      where: { id: userId },
      data: { lastDailyPopupAt: now },
    }),
  ]);
}
