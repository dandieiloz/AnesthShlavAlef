"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const DailyPopupSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "כותרת ריקה"),
  body: z.string().min(1, "תוכן ריק"),
  ctaLabel: z.string().trim().optional(),
  ctaHref: z.string().trim().optional(),
  enabled: z.boolean().optional(),
});

function parseForm(formData: FormData) {
  const ctaLabelRaw = ((formData.get("ctaLabel") as string) || "").trim();
  const ctaHrefRaw = ((formData.get("ctaHref") as string) || "").trim();
  return DailyPopupSchema.parse({
    id: (formData.get("id") as string) || undefined,
    title: ((formData.get("title") as string) || "").trim(),
    body: ((formData.get("body") as string) || "").trim(),
    ctaLabel: ctaLabelRaw || undefined,
    ctaHref: ctaHrefRaw || undefined,
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
  });
}

function invalidate() {
  revalidatePath("/admin/announcements/daily");
  revalidatePath("/", "layout");
}

export async function createDailyPopupAction(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.dailyPopup.create({
    data: {
      title: data.title,
      body: data.body,
      ctaLabel: data.ctaLabel ?? null,
      ctaHref: data.ctaHref ?? null,
      enabled: data.enabled ?? true,
    },
  });
  invalidate();
}

export async function updateDailyPopupAction(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  if (!data.id) throw new Error("Missing id");
  await db.dailyPopup.update({
    where: { id: data.id },
    data: {
      title: data.title,
      body: data.body,
      ctaLabel: data.ctaLabel ?? null,
      ctaHref: data.ctaHref ?? null,
      enabled: data.enabled ?? false,
    },
  });
  invalidate();
}

export async function toggleDailyPopupAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");
  const existing = await db.dailyPopup.findUnique({ where: { id }, select: { enabled: true } });
  if (!existing) return;
  await db.dailyPopup.update({ where: { id }, data: { enabled: !existing.enabled } });
  invalidate();
}

export async function deleteDailyPopupAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");
  await db.dailyPopup.delete({ where: { id } });
  invalidate();
}

export async function resetAcksDailyPopupAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");
  await db.dailyPopupAck.deleteMany({ where: { popupId: id } });
  invalidate();
}

/**
 * Forcefully re-show a specific daily popup to *every* user right now.
 *
 * Unlike `resetAcksDailyPopupAction`, this guarantees the popup actually
 * surfaces again by:
 *  1. Marking it as forced (`forcedAt`) so it bypasses the daily rotation and
 *     takes priority over every other enabled popup.
 *  2. Ensuring it's enabled.
 *  3. Clearing all acknowledgements so previously-dismissed users see it again.
 *  4. Clearing the once-per-day gate (`User.lastDailyPopupAt`) for everyone so
 *     it appears immediately, even for users who already saw a popup today.
 */
export async function forceShowDailyPopupAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");
  await db.$transaction([
    // Only one popup is forced at a time.
    db.dailyPopup.updateMany({ where: { id: { not: id } }, data: { forcedAt: null } }),
    db.dailyPopup.update({ where: { id }, data: { forcedAt: new Date(), enabled: true } }),
    db.dailyPopupAck.deleteMany({ where: { popupId: id } }),
    db.user.updateMany({ data: { lastDailyPopupAt: null } }),
  ]);
  invalidate();
}

