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
