"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ReportStatus } from "@prisma/client";

export async function resolveReportAction(formData: FormData) {
  const me = await requireAdmin();
  const id = Number(formData.get("id"));
  const status = String(formData.get("status")) as ReportStatus;
  const responseRaw = String(formData.get("response") ?? "").trim();
  const response = responseRaw.length > 0 ? responseRaw : null;
  if (!Number.isFinite(id) || (status !== "RESOLVED" && status !== "REJECTED")) return;

  await db.answerReport.update({
    where: { id },
    data: {
      status,
      resolvedById: me.id,
      adminResponse: response,
      adminResponseAt: response ? new Date() : null,
    },
  });
  revalidatePath("/admin/reports");
  revalidatePath("/profile");
}

export async function updateAnswerReportResponseAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const responseRaw = String(formData.get("response") ?? "").trim();
  const response = responseRaw.length > 0 ? responseRaw : null;
  if (!Number.isFinite(id)) return;

  await db.answerReport.update({
    where: { id },
    data: {
      adminResponse: response,
      adminResponseAt: response ? new Date() : null,
    },
  });
  revalidatePath("/admin/reports");
  revalidatePath("/profile");
}

export async function reopenReportAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  if (!Number.isFinite(id)) return;
  await db.answerReport.update({
    where: { id },
    data: { status: ReportStatus.OPEN, resolvedById: null, adminResponse: null, adminResponseAt: null },
  });
  revalidatePath("/admin/reports");
  revalidatePath("/profile");
}
