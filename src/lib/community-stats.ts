import { db } from "@/lib/db";

export interface HospitalActivityRow {
  hospitalName: string | null;
  solved: number;
  residents: number;
}

/** Questions answered in the last 24h across all users, grouped by hospital. */
export async function getHospitalActivity24h(): Promise<HospitalActivityRow[]> {
  const rows = await db.$queryRaw<Array<{ hospitalName: string | null; solved: bigint; residents: bigint }>>`
    SELECT u."hospitalName" AS "hospitalName", COUNT(*) AS "solved", COUNT(DISTINCT a."userId") AS "residents"
    FROM "Attempt" a
    JOIN "User" u ON u."id" = a."userId"
    WHERE a."createdAt" >= now() - interval '24 hours'
    GROUP BY u."hospitalName"
  `;
  return rows.map((r) => ({
    hospitalName: r.hospitalName,
    solved: Number(r.solved),
    residents: Number(r.residents),
  }));
}

export interface CommunitySummary {
  solved: number;
  residents: number;
  hospitals: number;
}

export function summarizeCommunity(rows: HospitalActivityRow[]): CommunitySummary {
  return {
    solved: rows.reduce((sum, r) => sum + r.solved, 0),
    residents: rows.reduce((sum, r) => sum + r.residents, 0),
    hospitals: rows.filter((r) => r.hospitalName !== null && r.solved > 0).length,
  };
}
