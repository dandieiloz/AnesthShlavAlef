import { db } from "@/lib/db";
import { AdminTabsNav } from "./AdminTabsNav";

export async function AdminNav() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [openReports, openDebugReports, newUsers] = await Promise.all([
    db.answerReport.count({ where: { status: "OPEN" } }),
    db.debugReport.count({ where: { status: "OPEN" } }),
    db.user.count({ where: { createdAt: { gte: since } } }),
  ]);

  return (
    <AdminTabsNav
      badges={{
        "/admin/reports": openReports,
        "/admin/debug-reports": openDebugReports,
        "/admin/users": newUsers,
      }}
    />
  );
}
