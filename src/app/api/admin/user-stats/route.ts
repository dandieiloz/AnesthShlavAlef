import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const Query = z.object({
  metric: z.enum(["active", "attempts", "signups", "visits", "visitors"]).default("attempts"),
  granularity: z.enum(["hour", "day", "month"]).default("day"),
});

type Granularity = z.infer<typeof Query>["granularity"];
type Metric = z.infer<typeof Query>["metric"];

const WINDOW: Record<Granularity, { interval: string; step: string }> = {
  hour: { interval: "48 hours", step: "1 hour" },
  day: { interval: "30 days", step: "1 day" },
  month: { interval: "12 months", step: "1 month" },
};

const SOURCE_TABLE: Record<Metric, string> = {
  attempts: `"Attempt"`,
  active: `"Attempt"`,
  signups: `"User"`,
  visits: `"ActivityPing"`,
  visitors: `"ActivityPing"`,
};

const DISTINCT_USER_METRICS: ReadonlySet<Metric> = new Set(["active", "visitors"]);

export async function GET(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const parsed = Query.safeParse({
    metric: url.searchParams.get("metric") ?? undefined,
    granularity: url.searchParams.get("granularity") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  const { metric, granularity } = parsed.data;
  const { interval, step } = WINDOW[granularity];

  const trunc = Prisma.raw(`'${granularity}'`);
  const intervalSql = Prisma.raw(`interval '${interval}'`);
  const stepSql = Prisma.raw(`interval '${step}'`);

  const sourceTable = Prisma.raw(SOURCE_TABLE[metric]);
  const sourceCol = Prisma.raw(`"createdAt"`);
  const aggregate = DISTINCT_USER_METRICS.has(metric)
    ? Prisma.raw(`COUNT(DISTINCT "userId")`)
    : Prisma.raw(`COUNT(*)`);

  // Build a series of buckets from now() back by `interval`, then LEFT JOIN
  // the source table truncated to the same granularity. Empty buckets → 0.
  const rows = await db.$queryRaw<Array<{ bucket: Date; value: bigint }>>`
    WITH series AS (
      SELECT generate_series(
        date_trunc(${trunc}, now() - ${intervalSql}),
        date_trunc(${trunc}, now()),
        ${stepSql}
      ) AS bucket
    )
    SELECT
      s.bucket AS bucket,
      COALESCE((
        SELECT ${aggregate}
        FROM ${sourceTable} t
        WHERE date_trunc(${trunc}, t.${sourceCol}) = s.bucket
      ), 0) AS value
    FROM series s
    ORDER BY s.bucket ASC
  `;

  const points = rows.map((r) => ({
    bucket: r.bucket.toISOString(),
    value: Number(r.value),
  }));

  return NextResponse.json({
    metric: metric satisfies Metric,
    granularity: granularity satisfies Granularity,
    points,
  });
}
