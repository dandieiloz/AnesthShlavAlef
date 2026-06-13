import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UsersTable, type UserRow } from "./UsersTable";
import { UsersFilters } from "./UsersFilters";
import { UserActivityChart } from "./UserActivityChart";
import { BlockEmailPanel } from "./BlockEmailPanel";
import { AdminNav } from "../AdminNav";
import { AutoRefresh } from "./AutoRefresh";
import { Suspense } from "react";

const LIMIT = 200;
const SORT_FIELDS = [
  "name",
  "role",
  "plan",
  "hospital",
  "residencyYear",
  "createdAt",
  "lastActive",
  "lastVisit",
  "profile",
  "pdf",
  "success",
  "drillSolved",
  "attempts",
] as const;

type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = "asc" | "desc";

function isSortField(v: string | undefined): v is SortField {
  return v !== undefined && SORT_FIELDS.includes(v as SortField);
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    role?: string;
    plan?: string;
    hospital?: string;
    profile?: string;
    activity?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const sort: SortField = isSortField(sp.sort) ? sp.sort : "lastActive";
  const order: SortOrder = sp.order === "asc" ? "asc" : "desc";
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (sp.q?.trim()) {
    where.OR = [
      { fullName: { contains: sp.q.trim(), mode: "insensitive" } },
      { name: { contains: sp.q.trim(), mode: "insensitive" } },
      { email: { contains: sp.q.trim(), mode: "insensitive" } },
    ];
  }

  if (sp.role === "ADMIN" || sp.role === "USER") {
    where.role = sp.role;
  }

  if (sp.plan === "DEMO" || sp.plan === "PAID") {
    where.plan = sp.plan;
  }

  if (sp.hospital?.trim()) {
    where.hospitalName = sp.hospital.trim();
  }

  if (sp.profile === "complete") {
    where.residencyYear = { not: null };
  } else if (sp.profile === "incomplete") {
    where.residencyYear = null;
  }

  if (sp.activity === "7d") {
    where.attempts = { some: { createdAt: { gte: daysAgo(7) } } };
  } else if (sp.activity === "30d") {
    where.attempts = { some: { createdAt: { gte: daysAgo(30) } } };
  } else if (sp.activity === "inactive30") {
    where.AND = [
      ...(where.AND ?? []),
      { attempts: { some: {} } },
      { attempts: { none: { createdAt: { gte: daysAgo(30) } } } },
    ];
  } else if (sp.activity === "never") {
    where.attempts = { none: {} };
  }

  const userSelect = {
    id: true,
    name: true,
    fullName: true,
    email: true,
    image: true,
    role: true,
    plan: true,
    hospitalName: true,
    residencyYear: true,
    createdAt: true,
    localPdfSetAt: true,
    scoreDrillSolved: true,
  } as const;

  // When sorting by lastActive we need to compute max(Attempt.createdAt) per
  // user. We fetch all matching user IDs, join with the per-user max from
  // Attempt, sort in JS (nulls always last), then slice.
  let users: Array<{
    id: string;
    name: string | null;
    fullName: string | null;
    email: string;
    image: string | null;
    role: "USER" | "ADMIN";
    plan: "DEMO" | "PAID";
    hospitalName: string | null;
    residencyYear: number | null;
    createdAt: Date;
    localPdfSetAt: Date | null;
    scoreDrillSolved: number;
  }>;
  let lastActiveByUser: Map<string, Date>;
  let lastVisitByUser: Map<string, Date> = new Map();

  if (sort === "lastActive") {
    const candidateIds = await db.user.findMany({ where, select: { id: true } });
    const ids = candidateIds.map((u) => u.id);
    const maxRows = ids.length
      ? await db.attempt.groupBy({
          by: ["userId"],
          where: { userId: { in: ids } },
          _max: { createdAt: true },
        })
      : [];
    lastActiveByUser = new Map(
      maxRows
        .filter((r): r is typeof r & { _max: { createdAt: Date } } => r._max.createdAt !== null)
        .map((r) => [r.userId, r._max.createdAt]),
    );
    const sorted = [...ids].sort((a, b) => {
      const ta = lastActiveByUser.get(a)?.getTime() ?? null;
      const tb = lastActiveByUser.get(b)?.getTime() ?? null;
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1; // nulls always last
      if (tb === null) return -1;
      return order === "asc" ? ta - tb : tb - ta;
    });
    const pageIds = sorted.slice(0, LIMIT);
    const fetched = pageIds.length
      ? await db.user.findMany({ where: { id: { in: pageIds } }, select: userSelect })
      : [];
    const byId = new Map(fetched.map((u) => [u.id, u]));
    users = pageIds.map((id) => byId.get(id)!).filter(Boolean);
  } else if (sort === "lastVisit") {
    // Mirror of the lastActive branch but sourced from ActivityPing via raw SQL
    // (Prisma client may not yet expose the new model after the migration).
    const candidateIds = await db.user.findMany({ where, select: { id: true } });
    const ids = candidateIds.map((u) => u.id);
    const maxRows = ids.length
      ? await db.$queryRaw<Array<{ userId: string; max: Date }>>`
          SELECT "userId", MAX("createdAt") AS max
          FROM "ActivityPing"
          WHERE "userId" = ANY(${ids}::text[])
          GROUP BY "userId"
        `
      : [];
    lastVisitByUser = new Map(maxRows.map((r) => [r.userId, r.max]));
    const sorted = [...ids].sort((a, b) => {
      const ta = lastVisitByUser.get(a)?.getTime() ?? null;
      const tb = lastVisitByUser.get(b)?.getTime() ?? null;
      if (ta === null && tb === null) return 0;
      if (ta === null) return 1; // nulls always last
      if (tb === null) return -1;
      return order === "asc" ? ta - tb : tb - ta;
    });
    const pageIds = sorted.slice(0, LIMIT);
    const fetched = pageIds.length
      ? await db.user.findMany({ where: { id: { in: pageIds } }, select: userSelect })
      : [];
    const byId = new Map(fetched.map((u) => [u.id, u]));
    users = pageIds.map((id) => byId.get(id)!).filter(Boolean);
    lastActiveByUser = new Map();
  } else if (sort === "success") {
    // Success % is computed (correct / total attempts) and not stored, so we
    // must compute it for every matching user, sort in JS (nulls last), then
    // slice — mirroring the lastActive branch.
    const candidateIds = await db.user.findMany({ where, select: { id: true } });
    const ids = candidateIds.map((u) => u.id);
    const [attemptRows, correctRows] = ids.length
      ? await Promise.all([
          db.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } }),
          db.attempt.groupBy({
            by: ["userId"],
            where: { userId: { in: ids }, isCorrect: true },
            _count: { _all: true },
          }),
        ])
      : [[], []];
    const totalMap = new Map(attemptRows.map((r) => [r.userId, r._count._all]));
    const correctMap = new Map(correctRows.map((r) => [r.userId, r._count._all]));
    const pct = (id: string): number | null => {
      const total = totalMap.get(id) ?? 0;
      if (total === 0) return null;
      return (correctMap.get(id) ?? 0) / total;
    };
    const sorted = [...ids].sort((a, b) => {
      const pa = pct(a);
      const pb = pct(b);
      if (pa === null && pb === null) return 0;
      if (pa === null) return 1; // nulls always last
      if (pb === null) return -1;
      return order === "asc" ? pa - pb : pb - pa;
    });
    const pageIds = sorted.slice(0, LIMIT);
    const fetched = pageIds.length
      ? await db.user.findMany({ where: { id: { in: pageIds } }, select: userSelect })
      : [];
    const byId = new Map(fetched.map((u) => [u.id, u]));
    users = pageIds.map((id) => byId.get(id)!).filter(Boolean);
    lastActiveByUser = new Map();
  } else if (sort === "attempts") {
    // History total = attempt count + score-drill counter. attemptCount is not
    // stored on User, so compute for every matching user, sort, then slice.
    const candidates = await db.user.findMany({
      where,
      select: { id: true, scoreDrillSolved: true },
    });
    const ids = candidates.map((c) => c.id);
    const drillMap = new Map(candidates.map((c) => [c.id, c.scoreDrillSolved]));
    const attemptRows = ids.length
      ? await db.attempt.groupBy({ by: ["userId"], where: { userId: { in: ids } }, _count: { _all: true } })
      : [];
    const totalMap = new Map(attemptRows.map((r) => [r.userId, r._count._all]));
    const metric = (id: string): number => (totalMap.get(id) ?? 0) + (drillMap.get(id) ?? 0);
    const sorted = [...ids].sort((a, b) =>
      order === "asc" ? metric(a) - metric(b) : metric(b) - metric(a),
    );
    const pageIds = sorted.slice(0, LIMIT);
    const fetched = pageIds.length
      ? await db.user.findMany({ where: { id: { in: pageIds } }, select: userSelect })
      : [];
    const byId = new Map(fetched.map((u) => [u.id, u]));
    users = pageIds.map((id) => byId.get(id)!).filter(Boolean);
    lastActiveByUser = new Map();
  } else {
    const orderBy =
      sort === "name"
        ? [{ fullName: order }, { name: order }]
        : sort === "role"
          ? { role: order }
          : sort === "plan"
            ? { plan: order }
            : sort === "hospital"
              ? { hospitalName: order }
              : sort === "residencyYear"
                ? { residencyYear: order }
                : sort === "drillSolved"
                  ? { scoreDrillSolved: order }
                  : sort === "profile"
                    ? // Group complete (residencyYear set) vs incomplete; toggle which group leads.
                      { residencyYear: { sort: "asc", nulls: order === "asc" ? "first" : "last" } as const }
                    : sort === "pdf"
                      ? // Group configured (localPdfSetAt set) vs not; toggle which group leads.
                        { localPdfSetAt: { sort: "desc", nulls: order === "asc" ? "first" : "last" } as const }
                      : { createdAt: order };

    users = await db.user.findMany({
      where,
      select: userSelect,
      orderBy,
      take: LIMIT,
    });
    lastActiveByUser = new Map();
  }

  const [filteredTotal, totalUsers, adminCount, demoCount, todayQuestionsDoneCount, drillSolvedAgg] = await Promise.all([
    db.user.count({ where }),
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { plan: "DEMO" } }),
    db.attempt.count({ where: { createdAt: { gte: todayStart, lt: tomorrowStart } } }),
    db.user.aggregate({ _sum: { scoreDrillSolved: true } }),
  ]);
  const totalDrillSolved = drillSolvedAgg._sum.scoreDrillSolved ?? 0;

  // Fetch attempt counts (and last-active when not already computed) for the
  // visible users. One indexed groupBy on Attempt(userId) per stat.
  const userIds = users.map((u) => u.id);
  const attemptStats = userIds.length
    ? await db.attempt.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const attemptCountByUser = new Map<string, number>(
    attemptStats.map((row) => [row.userId, row._count._all]),
  );
  // Correct-answer counts per visible user, to derive a success percentage.
  const correctStats = userIds.length
    ? await db.attempt.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds }, isCorrect: true },
        _count: { _all: true },
      })
    : [];
  const correctCountByUser = new Map<string, number>(
    correctStats.map((row) => [row.userId, row._count._all]),
  );
  if (sort !== "lastActive") {    lastActiveByUser = new Map(
      attemptStats
        .filter((r): r is typeof r & { _max: { createdAt: Date } } => r._max.createdAt !== null)
        .map((r) => [r.userId, r._max.createdAt]),
    );
  }

  // Last platform visit (any authenticated page load) for the visible users.
  // Sourced from ActivityPing, distinct from attempt-based "ענה לאחרונה".
  // Raw SQL because the Prisma client may not yet expose the new model.
  // Skipped when sorting by lastVisit because that branch already populated the map.
  if (sort !== "lastVisit") {
    const visitRows = userIds.length
      ? await db.$queryRaw<Array<{ userId: string; max: Date }>>`
          SELECT "userId", MAX("createdAt") AS max
          FROM "ActivityPing"
          WHERE "userId" = ANY(${userIds}::text[])
          GROUP BY "userId"
        `
      : [];
    lastVisitByUser = new Map<string, Date>(visitRows.map((r) => [r.userId, r.max]));
  }

  // Blocked-email lookup: a Set for the visible rows + the full blocklist for
  // the standalone panel (includes emails that have no account yet).
  const visibleEmails = users.map((u) => u.email.trim().toLowerCase());
  const [visibleBlocked, allBlocked] = await Promise.all([
    visibleEmails.length
      ? db.blockedEmail.findMany({
          where: { email: { in: visibleEmails } },
          select: { email: true },
        })
      : Promise.resolve([]),
    db.blockedEmail.findMany({
      orderBy: { createdAt: "desc" },
      select: { email: true, reason: true, createdAt: true },
    }),
  ]);
  const blockedEmailSet = new Set(visibleBlocked.map((b) => b.email));
  const blockedList = allBlocked.map((b) => ({
    email: b.email,
    reason: b.reason,
    createdAt: b.createdAt.toISOString(),
  }));

  const rows: UserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    fullName: u.fullName,
    email: u.email,
    image: u.image,
    role: u.role,
    plan: u.plan,
    hospitalName: u.hospitalName,
    residencyYear: u.residencyYear,
    createdAt: u.createdAt.toISOString(),
    lastActiveAt: lastActiveByUser.get(u.id)?.toISOString() ?? null,
    lastVisitAt: lastVisitByUser.get(u.id)?.toISOString() ?? null,
    attemptCount: attemptCountByUser.get(u.id) ?? 0,
    localPdfSet: u.localPdfSetAt !== null,
    scoreDrillSolved: u.scoreDrillSolved,
    successPercent: (() => {
      const total = attemptCountByUser.get(u.id) ?? 0;
      if (total === 0) return null;
      return Math.round(((correctCountByUser.get(u.id) ?? 0) / total) * 100);
    })(),
    blocked: blockedEmailSet.has(u.email.trim().toLowerCase()),
  }));

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <AdminNav />
      <h1 className="font-display text-2xl font-bold">ניהול משתמשים</h1>

      <UserActivityChart />

      {/* Summary stat cards */}
      <div className="grid grid-cols-5 gap-3">
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono">{totalUsers}</div>
          <div className="text-xs text-muted-foreground mt-1">סה״כ משתמשים</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-purple-600 dark:text-purple-400">{adminCount}</div>
          <div className="text-xs text-muted-foreground mt-1">מנהלים</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">{demoCount}</div>
          <div className="text-xs text-muted-foreground mt-1">משתמשי דמו</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-orange-600 dark:text-orange-400">{todayQuestionsDoneCount}</div>
          <div className="text-xs text-muted-foreground mt-1">שאלות שבוצעו היום (00:00-23:59)</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-teal-600 dark:text-teal-400">{totalDrillSolved}</div>
          <div className="text-xs text-muted-foreground mt-1">תרגול ציונים (סה״כ)</div>
        </div>
      </div>

      <Suspense>
        <UsersFilters />
      </Suspense>

      <BlockEmailPanel blocked={blockedList} />

      <div className="text-sm text-muted-foreground">
        {filteredTotal > LIMIT
          ? `מציג ${LIMIT} מתוך ${filteredTotal} משתמשים`
          : `${filteredTotal} משתמשים`}
      </div>

      <UsersTable users={rows} sort={sort} order={order} currentUserId={me.id} />
    </div>
  );
}
