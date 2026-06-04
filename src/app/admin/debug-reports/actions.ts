"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { ReportStatus } from "@prisma/client";

export async function resolveDebugReportAction(formData: FormData) {
  const me = await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as ReportStatus;
  const responseRaw = String(formData.get("response") ?? "").trim();
  const response = responseRaw.length > 0 ? responseRaw : null;
  if (!Number.isFinite(id) || (status !== "RESOLVED" && status !== "REJECTED")) return;

  await db.debugReport.update({
    where: { id },
    data: {
      status,
      resolvedById: me.id,
      resolvedAt: new Date(),
      adminResponse: response,
      adminResponseAt: response ? new Date() : null,
    },
  });
  revalidatePath("/admin/debug-reports");
  revalidatePath("/profile");
}

export async function updateDebugReportResponseAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const responseRaw = String(formData.get("response") ?? "").trim();
  const response = responseRaw.length > 0 ? responseRaw : null;
  if (!Number.isFinite(id)) return;

  await db.debugReport.update({
    where: { id },
    data: {
      adminResponse: response,
      adminResponseAt: response ? new Date() : null,
    },
  });
  revalidatePath("/admin/debug-reports");
  revalidatePath("/profile");
}

export async function reopenDebugReportAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.debugReport.update({
    where: { id },
    data: {
      status: "OPEN",
      resolvedById: null,
      resolvedAt: null,
      adminResponse: null,
      adminResponseAt: null,
    },
  });
  revalidatePath("/admin/debug-reports");
  revalidatePath("/profile");
}
