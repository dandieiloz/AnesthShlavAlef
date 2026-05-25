"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { ReportStatus } from "@prisma/client";

export async function resolveReportAction(reportId: number, status: ReportStatus) {
  const me = await requireAdmin();
  await db.answerReport.update({
    where: { id: reportId },
    data: { status, resolvedById: me.id },
  });
  revalidatePath("/admin/reports");
}
