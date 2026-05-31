"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import type { ReportStatus } from "@prisma/client";

export async function resolveDebugReportAction(id: number, status: ReportStatus) {
  const me = await requireAdmin();
  await db.debugReport.update({
    where: { id },
    data: {
      status,
      resolvedById: me.id,
      resolvedAt: new Date(),
    },
  });
  revalidatePath("/admin/debug-reports");
}
