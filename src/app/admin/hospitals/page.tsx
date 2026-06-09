import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "../AdminNav";
import { HospitalStats, type HospitalRow } from "./HospitalStats";

export const dynamic = "force-dynamic";

const NO_HOSPITAL_LABEL = "ללא בית חולים";

export default async function AdminHospitalsPage() {
  await requireAdmin();

  // 1) Total users per hospital (including users with no attempts).
  const userGroups = await db.user.groupBy({
    by: ["hospitalName"],
    _count: { _all: true },
  });

  // 2) Activity + accuracy per hospital in a single raw query joining
  //    Attempt -> User. Active = distinct users with >=1 attempt in window.
  const activityRows = await db.$queryRaw<
    Array<{
      hospitalName: string | null;
      active7: bigint;
      active30: bigint;
      attempts: bigint;
      correct: bigint;
      attemptUsers: bigint;
    }>
  >`
    SELECT
      u."hospitalName"                                              AS "hospitalName",
      COUNT(DISTINCT a."userId") FILTER (
        WHERE a."createdAt" >= now() - interval '7 days'
      )                                                             AS "active7",
      COUNT(DISTINCT a."userId") FILTER (
        WHERE a."createdAt" >= now() - interval '30 days'
      )                                                             AS "active30",
      COUNT(*)                                                      AS "attempts",
      COUNT(*) FILTER (WHERE a."isCorrect")                         AS "correct",
      COUNT(DISTINCT a."userId")                                    AS "attemptUsers"
    FROM "Attempt" a
    JOIN "User" u ON u."id" = a."userId"
    GROUP BY u."hospitalName"
  `;

  const activityByHospital = new Map(
    activityRows.map((r) => [r.hospitalName, r]),
  );

  const rows: HospitalRow[] = userGroups
    .map((g) => {
      const key = g.hospitalName;
      const act = activityByHospital.get(key);
      const attempts = act ? Number(act.attempts) : 0;
      const correct = act ? Number(act.correct) : 0;
      return {
        hospital: key ?? NO_HOSPITAL_LABEL,
        isNull: key === null,
        totalUsers: g._count._all,
        active7: act ? Number(act.active7) : 0,
        active30: act ? Number(act.active30) : 0,
        attempts,
        accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : null,
      };
    })
    .sort((a, b) => b.totalUsers - a.totalUsers);

  const totalUsers = rows.reduce((s, r) => s + r.totalUsers, 0);
  const usersWithHospital = rows
    .filter((r) => !r.isNull)
    .reduce((s, r) => s + r.totalUsers, 0);
  const usersWithoutHospital = totalUsers - usersWithHospital;
  const hospitalCount = rows.filter((r) => !r.isNull && r.totalUsers > 0).length;

  return (
    <div className="space-y-4">
      <AdminNav />
      <div>
        <h1 className="font-display text-2xl font-bold">סטטיסטיקה לפי בית חולים</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          פילוח משתמשים, פעילות ואחוזי הצלחה לפי בית החולים שבחרו בפרופיל.
        </p>
      </div>

      <HospitalStats
        rows={rows}
        summary={{
          hospitalCount,
          usersWithHospital,
          usersWithoutHospital,
          totalUsers,
        }}
      />
    </div>
  );
}
