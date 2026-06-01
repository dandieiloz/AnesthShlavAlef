"use client";
import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setUserRoleAction, setUserPlanAction, deleteUserAction } from "./actions";

export type UserRow = {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string;
  image: string | null;
  role: "USER" | "ADMIN";
  plan: "DEMO" | "PAID";
  hospitalName: string | null;
  residencyYear: number | null;
  createdAt: string;
  lastActiveAt: string | null;
  attemptCount: number;
};

type SortField =
  | "name"
  | "role"
  | "plan"
  | "hospital"
  | "residencyYear"
  | "createdAt"
  | "lastActive";
type SortOrder = "asc" | "desc";

const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", { dateStyle: "short" });
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});
const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("he-IL", { numeric: "auto" });

function formatRelative(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - nowMs) / 1000);
  const absSec = Math.abs(diffSec);
  if (absSec < 60) return RELATIVE_FORMATTER.format(diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return RELATIVE_FORMATTER.format(diffMin, "minute");
  const diffHr = Math.round(diffMin / 60);
  if (Math.abs(diffHr) < 24) return RELATIVE_FORMATTER.format(diffHr, "hour");
  const diffDay = Math.round(diffHr / 24);
  if (Math.abs(diffDay) < 30) return RELATIVE_FORMATTER.format(diffDay, "day");
  const diffMo = Math.round(diffDay / 30);
  if (Math.abs(diffMo) < 12) return RELATIVE_FORMATTER.format(diffMo, "month");
  return RELATIVE_FORMATTER.format(Math.round(diffMo / 12), "year");
}

const DEFAULT_SORT_ORDER: Record<SortField, SortOrder> = {
  name: "asc",
  role: "asc",
  plan: "asc",
  hospital: "asc",
  residencyYear: "asc",
  createdAt: "desc",
  lastActive: "desc",
};

export function UsersTable({
  users,
  sort,
  order,
  currentUserId,
}: {
  users: UserRow[];
  sort: SortField;
  order: SortOrder;
  currentUserId: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [relativeNowMs, setRelativeNowMs] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  // Avoid SSR/CSR hydration drift by rendering a stable fallback first,
  // then enabling live relative timestamps on the client after mount.
  useEffect(() => {
    setRelativeNowMs(Date.now());
  }, []);

  function toggleRole(userId: string, currentRole: "USER" | "ADMIN") {
    const newRole: "USER" | "ADMIN" = currentRole === "ADMIN" ? "USER" : "ADMIN";
    setPendingId(userId);
    startTransition(async () => {
      await setUserRoleAction(userId, newRole);
      setPendingId(null);
      router.refresh();
    });
  }

  function togglePlan(userId: string, currentPlan: "DEMO" | "PAID") {
    const newPlan: "DEMO" | "PAID" = currentPlan === "PAID" ? "DEMO" : "PAID";
    setPendingId(userId);
    startTransition(async () => {
      await setUserPlanAction(userId, newPlan);
      setPendingId(null);
      router.refresh();
    });
  }

  function deleteUser(userId: string, displayName: string) {
    const confirmed = window.confirm(
      `למחוק את המשתמש "${displayName}"? פעולה זו תמחק את כל המבחנים, התשובות, הסימניות וההערות שלו ואינה ניתנת לביטול.`,
    );
    if (!confirmed) return;
    setPendingId(userId);
    startTransition(async () => {
      try {
        await deleteUserAction(userId);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "מחיקת המשתמש נכשלה");
      }
      setPendingId(null);
      router.refresh();
    });
  }

  function sortHref(field: SortField) {
    const nextParams = new URLSearchParams(searchParams.toString());
    const nextOrder: SortOrder =
      sort === field
        ? order === "asc"
          ? "desc"
          : "asc"
        : DEFAULT_SORT_ORDER[field];
    nextParams.set("sort", field);
    nextParams.set("order", nextOrder);
    return `${pathname}?${nextParams.toString()}`;
  }

  function sortIndicator(field: SortField) {
    if (sort !== field) return "";
    return order === "asc" ? " ▲" : " ▼";
  }

  function SortHeader({
    field,
    label,
    align = "start",
    className = "",
  }: {
    field: SortField;
    label: string;
    align?: "start" | "center";
    className?: string;
  }) {
    const alignClass = align === "center" ? "text-center" : "text-start";
    return (
      <th className={`p-2 ${alignClass} text-muted-foreground whitespace-nowrap ${className}`.trim()}>
        <Link href={sortHref(field)} className="inline-flex items-center gap-1 hover:text-foreground">
          <span>{label}</span>
          <span aria-hidden="true">{sortIndicator(field)}</span>
        </Link>
      </th>
    );
  }

  if (users.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        לא נמצאו משתמשים התואמים את הסינון.
      </p>
    );
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b bg-muted/40">
          <SortHeader field="name" label="משתמש" />
          <SortHeader field="role" label="תפקיד" align="center" />
          <SortHeader field="plan" label="תוכנית" align="center" />
          <SortHeader field="hospital" label="בית חולים" />
          <SortHeader field="residencyYear" label="שנה" align="center" />
          <SortHeader field="createdAt" label="הצטרף" />
          <SortHeader field="lastActive" label="פעיל לאחרונה" />
          <th className="p-2 text-center text-muted-foreground whitespace-nowrap">פרופיל</th>
          <th className="p-2 text-center text-muted-foreground whitespace-nowrap">היסטוריה</th>
          <th className="p-2 text-center text-muted-foreground whitespace-nowrap">פעולות</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const displayName = u.fullName ?? u.name ?? u.email;
          const isSelf = u.id === currentUserId;
          const isPending = pendingId === u.id;
          const profileComplete = u.residencyYear !== null;

          return (
            <tr key={u.id} className="border-b hover:bg-muted/30 transition-colors">
              {/* Identity */}
              <td className="p-2">
                <div className="flex items-center gap-2">
                  {u.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={u.image}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 text-xs font-medium text-muted-foreground">
                      {(displayName?.[0] ?? "?").toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium truncate">{displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                  </div>
                </div>
              </td>

              {/* Role badge */}
              <td className="p-2 text-center">
                <span
                  className={`text-xs rounded px-2 py-0.5 ${
                    u.role === "ADMIN"
                      ? "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {u.role === "ADMIN" ? "מנהל" : "משתמש"}
                </span>
              </td>

              {/* Plan badge */}
              <td className="p-2 text-center">
                <span
                  className={`text-xs rounded px-2 py-0.5 ${
                    u.plan === "PAID"
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300"
                      : "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300"
                  }`}
                >
                  {u.plan === "PAID" ? "בתשלום" : "דמו"}
                </span>
              </td>

              {/* Hospital */}
              <td className="p-2 text-muted-foreground">
                {u.hospitalName ?? <span className="italic text-muted-foreground/50">—</span>}
              </td>

              {/* Residency year */}
              <td className="p-2 text-center text-muted-foreground">
                {u.residencyYear ?? <span className="italic text-muted-foreground/50">—</span>}
              </td>

              {/* Joined */}
              <td className="p-2 text-muted-foreground whitespace-nowrap">
                {DATE_FORMATTER.format(new Date(u.createdAt))}
              </td>

              {/* Last active */}
              <td className="p-2 text-muted-foreground whitespace-nowrap">
                {u.lastActiveAt ? (
                  <span title={DATE_TIME_FORMATTER.format(new Date(u.lastActiveAt))}>
                    {relativeNowMs === null
                      ? DATE_TIME_FORMATTER.format(new Date(u.lastActiveAt))
                      : formatRelative(u.lastActiveAt, relativeNowMs)}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/50">—</span>
                )}
              </td>

              {/* Profile status */}
              <td className="p-2 text-center">
                <span
                  className={`text-xs rounded px-2 py-0.5 ${
                    profileComplete
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      : "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300"
                  }`}
                >
                  {profileComplete ? "מלא" : "חסר"}
                </span>
              </td>

              {/* History link */}
              <td className="p-2 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="font-mono text-xs text-muted-foreground tabular-nums min-w-[2ch] text-end"
                    title="סה”כ ניסיונות"
                  >
                    {u.attemptCount}
                  </span>
                  <Link
                    href={`/admin/users/${u.id}/attempts`}
                    className="inline-block rounded border px-2 py-1 text-xs hover:bg-muted"
                  >
                    צפייה
                  </Link>
                </div>
              </td>

              {/* Role toggle */}
              <td className="p-2 text-center">
                <div className="flex flex-col gap-1 items-stretch">
                  <button
                    onClick={() => toggleRole(u.id, u.role)}
                    disabled={isSelf || isPending}
                    title={isSelf ? "לא ניתן לשנות את תפקידך שלך" : undefined}
                    className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      u.role === "ADMIN"
                        ? "hover:bg-muted text-muted-foreground"
                        : "border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    }`}
                  >
                    {isPending ? "..." : u.role === "ADMIN" ? "הורד לרגיל" : "קדם לאדמין"}
                  </button>
                  <button
                    onClick={() => togglePlan(u.id, u.plan)}
                    disabled={isSelf || isPending}
                    title={isSelf ? "לא ניתן לשנות את התוכנית שלך" : undefined}
                    className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      u.plan === "PAID"
                        ? "hover:bg-muted text-muted-foreground"
                        : "border-emerald-400 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    }`}
                  >
                    {isPending ? "..." : u.plan === "PAID" ? "הורד לדמו" : "שדרג לבתשלום"}
                  </button>
                  <button
                    onClick={() => deleteUser(u.id, displayName)}
                    disabled={isSelf || isPending}
                    title={isSelf ? "לא ניתן למחוק את עצמך" : "מחיקת משתמש"}
                    className="rounded border border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-2 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isPending ? "..." : "מחק משתמש"}
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
