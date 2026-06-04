import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UsersTable, type UserRow } from "./UsersTable";
import { UsersFilters } from "./UsersFilters";
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
  const sort: SortField = isSortField(sp.sort) ? sp.sort : "createdAt";
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
  }>;
  let lastActiveByUser: Map<string, Date>;

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
                : { createdAt: order };

    users = await db.user.findMany({
      where,
      select: userSelect,
      orderBy,
      take: LIMIT,
    });
    lastActiveByUser = new Map();
  }

  const [filteredTotal, totalUsers, adminCount, demoCount, todayQuestionsDoneCount] = await Promise.all([
    db.user.count({ where }),
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { plan: "DEMO" } }),
    db.attempt.count({ where: { createdAt: { gte: todayStart, lt: tomorrowStart } } }),
  ]);

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
  if (sort !== "lastActive") {
    lastActiveByUser = new Map(
      attemptStats
        .filter((r): r is typeof r & { _max: { createdAt: Date } } => r._max.createdAt !== null)
        .map((r) => [r.userId, r._max.createdAt]),
    );
  }

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
    attemptCount: attemptCountByUser.get(u.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <AutoRefresh />
      <AdminNav />
      <h1 className="font-display text-2xl font-bold">ניהול משתמשים</h1>

      {/* Summary stat cards */}
      <div className="grid grid-cols-4 gap-3">
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
      </div>

      <Suspense>
        <UsersFilters />
      </Suspense>

      <div className="text-sm text-muted-foreground">
        {filteredTotal > LIMIT
          ? `מציג ${LIMIT} מתוך ${filteredTotal} משתמשים`
          : `${filteredTotal} משתמשים`}
      </div>

      <UsersTable users={rows} sort={sort} order={order} currentUserId={me.id} />
    </div>
  );
}
