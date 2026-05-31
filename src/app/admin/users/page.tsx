import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { UsersTable, type UserRow } from "./UsersTable";
import { UsersFilters } from "./UsersFilters";
import { AdminTabsNav } from "../AdminTabsNav";
import { Suspense } from "react";

const LIMIT = 200;
const SORT_FIELDS = ["name", "role", "plan", "hospital", "residencyYear", "createdAt"] as const;

type SortField = (typeof SORT_FIELDS)[number];
type SortOrder = "asc" | "desc";

function isSortField(v: string | undefined): v is SortField {
  return v !== undefined && SORT_FIELDS.includes(v as SortField);
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
    sort?: string;
    order?: string;
  }>;
}) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const sort: SortField = isSortField(sp.sort) ? sp.sort : "createdAt";
  const order: SortOrder = sp.order === "asc" ? "asc" : "desc";

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

  const [users, filteredTotal, totalUsers, adminCount, demoCount, noProfileCount] = await Promise.all([
    db.user.findMany({
      where,
      select: {
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
      },
      orderBy,
      take: LIMIT,
    }),
    db.user.count({ where }),
    db.user.count(),
    db.user.count({ where: { role: "ADMIN" } }),
    db.user.count({ where: { plan: "DEMO" } }),
    db.user.count({ where: { residencyYear: null } }),
  ]);

  // Fetch attempt counts only for the users we're about to render. One indexed
  // groupBy on Attempt(userId) keeps this O(visibleUsers) rather than N+1.
  const userIds = users.map((u) => u.id);
  const attemptCounts = userIds.length
    ? await db.attempt.groupBy({
        by: ["userId"],
        where: { userId: { in: userIds } },
        _count: { _all: true },
      })
    : [];
  const attemptCountByUser = new Map<string, number>(
    attemptCounts.map((row) => [row.userId, row._count._all]),
  );

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
    attemptCount: attemptCountByUser.get(u.id) ?? 0,
  }));

  return (
    <div className="space-y-4">
      <AdminTabsNav />
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
          <div className="text-2xl font-bold font-mono text-orange-600 dark:text-orange-400">{noProfileCount}</div>
          <div className="text-xs text-muted-foreground mt-1">פרופיל חסר</div>
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
