import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MetricSchema = z.enum(["active", "attempts", "signups", "visits", "visitors"]);
const DateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
});

const Query = z
  .object({
    metric: MetricSchema.optional(),
    metrics: z.string().optional(),
    granularity: z.enum(["hour", "day", "month"]).default("day"),
    from: DateSchema.optional(),
    to: DateSchema.optional(),
  })
  .superRefine(({ from, to }, ctx) => {
    if ((from === undefined) !== (to === undefined) || (from && to && from > to)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "invalid date range" });
    }
  });

type Granularity = z.infer<typeof Query>["granularity"];
type Metric = z.infer<typeof MetricSchema>;

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
    metrics: url.searchParams.get("metrics") ?? undefined,
    granularity: url.searchParams.get("granularity") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const metricValues = parsed.data.metrics?.split(",") ?? [parsed.data.metric ?? "attempts"];
  const metricResult = z.array(MetricSchema).min(1).safeParse(metricValues);
  if (!metricResult.success) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }
  const metrics = [...new Set(metricResult.data)];

  const customRange = parsed.data.from !== undefined && parsed.data.to !== undefined;
  let granularity = parsed.data.granularity;
  if (customRange) {
    const startDay = Date.parse(`${parsed.data.from}T00:00:00Z`);
    const endDay = Date.parse(`${parsed.data.to}T00:00:00Z`);
    const inclusiveDays = Math.round((endDay - startDay) / 86_400_000) + 1;
    granularity = inclusiveDays <= 2 ? "hour" : inclusiveDays <= 90 ? "day" : "month";
  }

  const { interval, step } = WINDOW[granularity];

  const trunc = Prisma.raw(`'${granularity}'`);
  const intervalSql = Prisma.raw(`interval '${interval}'`);
  const stepSql = Prisma.raw(`interval '${step}'`);

  const seriesSql = customRange
    ? Prisma.sql`
        SELECT
          local_bucket AT TIME ZONE 'Asia/Jerusalem' AS bucket,
          (local_bucket + ${stepSql}) AT TIME ZONE 'Asia/Jerusalem' AS bucket_end,
          ${parsed.data.from}::date::timestamp AT TIME ZONE 'Asia/Jerusalem' AS range_start,
          (${parsed.data.to}::date + 1)::timestamp AT TIME ZONE 'Asia/Jerusalem' AS range_end
        FROM generate_series(
          date_trunc(${trunc}, ${parsed.data.from}::date::timestamp),
          date_trunc(${trunc}, ${parsed.data.to}::date::timestamp),
          ${stepSql}
        ) AS local_bucket
      `
    : Prisma.sql`
        SELECT
          bucket,
          bucket + ${stepSql} AS bucket_end
        FROM generate_series(
          date_trunc(${trunc}, now() - ${intervalSql}),
          date_trunc(${trunc}, now()),
          ${stepSql}
        ) AS bucket
      `;

  const metricSelects = metrics.map((metric) => {
    const sourceTable = Prisma.raw(SOURCE_TABLE[metric]);
    const aggregate = DISTINCT_USER_METRICS.has(metric)
      ? Prisma.raw(`COUNT(DISTINCT "userId")`)
      : Prisma.raw(`COUNT(*)`);
    const alias = Prisma.raw(`"${metric}"`);
    const bucketPredicate = customRange
      ? Prisma.sql`t."createdAt" >= (GREATEST(s.bucket, s.range_start) AT TIME ZONE 'UTC')
          AND t."createdAt" < (LEAST(s.bucket_end, s.range_end) AT TIME ZONE 'UTC')`
      : Prisma.sql`date_trunc(${trunc}, t."createdAt") = s.bucket`;

    return Prisma.sql`
      COALESCE((
        SELECT ${aggregate}
        FROM ${sourceTable} t
        WHERE ${bucketPredicate}
      ), 0) AS ${alias}
    `;
  });

  const rows = await db.$queryRaw<Array<{ bucket: Date } & Record<Metric, bigint>>>(
    Prisma.sql`
      WITH series AS (${seriesSql})
      SELECT s.bucket, ${Prisma.join(metricSelects, ",")}
      FROM series s
      ORDER BY s.bucket ASC
    `,
  );

  const points = rows.map((row) => ({
    bucket: row.bucket.toISOString(),
    ...Object.fromEntries(metrics.map((metric) => [metric, Number(row[metric])])),
  }));

  return NextResponse.json({
    metrics,
    granularity: granularity satisfies Granularity,
    points,
  });
}
