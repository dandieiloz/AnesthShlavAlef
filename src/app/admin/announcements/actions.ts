"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const AnnouncementSchema = z.object({
  id: z.string().optional(),
  message: z.string().min(1, "הודעה ריקה"),
  ctaLabel: z.string().trim().optional(),
  ctaHref: z.string().trim().optional(),
  enabled: z.boolean().optional(),
});

function parseForm(formData: FormData) {
  const ctaLabelRaw = ((formData.get("ctaLabel") as string) || "").trim();
  const ctaHrefRaw = ((formData.get("ctaHref") as string) || "").trim();
  return AnnouncementSchema.parse({
    id: (formData.get("id") as string) || undefined,
    message: ((formData.get("message") as string) || "").trim(),
    ctaLabel: ctaLabelRaw || undefined,
    ctaHref: ctaHrefRaw || undefined,
    enabled: formData.get("enabled") === "on" || formData.get("enabled") === "true",
  });
}

function invalidate() {
  revalidatePath("/admin/announcements");
  revalidatePath("/", "layout");
}

export async function createAnnouncementAction(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  await db.announcement.create({
    data: {
      message: data.message,
      ctaLabel: data.ctaLabel ?? null,
      ctaHref: data.ctaHref ?? null,
      enabled: data.enabled ?? true,
    },
  });
  invalidate();
}

export async function updateAnnouncementAction(formData: FormData) {
  await requireAdmin();
  const data = parseForm(formData);
  if (!data.id) throw new Error("Missing id");
  await db.announcement.update({
    where: { id: data.id },
    data: {
      message: data.message,
      ctaLabel: data.ctaLabel ?? null,
      ctaHref: data.ctaHref ?? null,
      enabled: data.enabled ?? false,
    },
  });
  invalidate();
}

export async function toggleAnnouncementAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");
  const existing = await db.announcement.findUnique({ where: { id }, select: { enabled: true } });
  if (!existing) return;
  await db.announcement.update({ where: { id }, data: { enabled: !existing.enabled } });
  invalidate();
}

export async function deleteAnnouncementAction(formData: FormData) {
  await requireAdmin();
  const id = formData.get("id") as string;
  if (!id) throw new Error("Missing id");
  await db.announcement.delete({ where: { id } });
  invalidate();
}
