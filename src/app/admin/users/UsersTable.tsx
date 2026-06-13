"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setUserRoleAction, setUserPlanAction, deleteUserAction, blockEmailAction, unblockEmailAction } from "./actions";
import { formatRelativeTime } from "@/lib/format-time";
import { useRelativeNow } from "@/lib/use-relative-now";

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
  lastVisitAt: string | null;
  attemptCount: number;
  localPdfSet: boolean;
  successPercent: number | null;
  scoreDrillSolved: number;
  blocked: boolean;
};

type SortField =
  | "name"
  | "role"
  | "plan"
  | "hospital"
  | "residencyYear"
  | "createdAt"
  | "lastActive"
  | "lastVisit"
  | "profile"
  | "pdf"
  | "success"
  | "drillSolved"
  | "attempts";
type SortOrder = "asc" | "desc";

const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeZone: "Asia/Jerusalem",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Asia/Jerusalem",
});

const DEFAULT_SORT_ORDER: Record<SortField, SortOrder> = {
  name: "asc",
  role: "asc",
  plan: "asc",
  hospital: "asc",
  residencyYear: "asc",
  createdAt: "desc",
  lastActive: "desc",
  lastVisit: "desc",
  profile: "desc",
  pdf: "desc",
  success: "desc",
  drillSolved: "desc",
  attempts: "desc",
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
  const relativeNowMs = useRelativeNow();
  const [, startTransition] = useTransition();

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

  function toggleBlock(userId: string, email: string, currentlyBlocked: boolean) {
    setPendingId(userId);
    startTransition(async () => {
      try {
        if (currentlyBlocked) {
          await unblockEmailAction(email);
        } else {
          await blockEmailAction(email);
        }
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "פעולת החסימה נכשלה");
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
          <SortHeader field="lastActive" label="ענה לאחרונה" />
          <SortHeader field="lastVisit" label="ביקור אחרון" />
          <SortHeader field="profile" label="פרופיל" align="center" />
          <SortHeader field="pdf" label="PDF" align="center" />
          <SortHeader field="success" label="אחוז הצלחה" align="center" />
          <SortHeader field="drillSolved" label="תרגול ציונים" align="center" />
          <SortHeader field="attempts" label="היסטוריה" align="center" />
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

              {/* Last answered (attempt-based) */}
              <td className="p-2 text-muted-foreground whitespace-nowrap">
                {u.lastActiveAt ? (
                  <span title={DATE_TIME_FORMATTER.format(new Date(u.lastActiveAt))}>
                    {relativeNowMs === null
                      ? DATE_TIME_FORMATTER.format(new Date(u.lastActiveAt))
                      : formatRelativeTime(u.lastActiveAt, relativeNowMs, "he")}
                  </span>
                ) : (
                  <span className="italic text-muted-foreground/50">—</span>
                )}
              </td>

              {/* Last visit (any platform page load, ping-based) */}
              <td className="p-2 text-muted-foreground whitespace-nowrap">
                {u.lastVisitAt ? (
                  <span title={DATE_TIME_FORMATTER.format(new Date(u.lastVisitAt))}>
                    {relativeNowMs === null
                      ? DATE_TIME_FORMATTER.format(new Date(u.lastVisitAt))
                      : formatRelativeTime(u.lastVisitAt, relativeNowMs, "he")}
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

              {/* Local PDF configured */}
              <td className="p-2 text-center">
                <span
                  className={`text-xs rounded px-2 py-0.5 ${
                    u.localPdfSet
                      ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {u.localPdfSet ? "מוגדר" : "לא מוגדר"}
                </span>
              </td>

              {/* Success percentage */}
              <td className="p-2 text-center text-muted-foreground whitespace-nowrap">
                {u.successPercent !== null ? (
                  <span className="font-mono text-xs tabular-nums">{u.successPercent}%</span>
                ) : (
                  <span className="italic text-muted-foreground/50">—</span>
                )}
              </td>

              {/* Score-drill questions solved */}
              <td className="p-2 text-center text-muted-foreground whitespace-nowrap">
                {u.scoreDrillSolved > 0 ? (
                  <span className="font-mono text-xs tabular-nums">{u.scoreDrillSolved}</span>
                ) : (
                  <span className="italic text-muted-foreground/50">—</span>
                )}
              </td>

              {/* History link */}
              <td className="p-2 text-center">
                <div className="flex items-center justify-center gap-2">
                  <span
                    className="font-mono text-xs text-muted-foreground tabular-nums min-w-[2ch] text-end"
                    title="סה״כ שאלות שנפתרו (ניסיונות + תרגול ציונים)"
                  >
                    {u.attemptCount + u.scoreDrillSolved}
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
                  <button
                    onClick={() => toggleBlock(u.id, u.email, u.blocked)}
                    disabled={isSelf || isPending}
                    title={isSelf ? "לא ניתן לחסום את עצמך" : u.blocked ? "ביטול חסימת המשתמש" : "חסימת המשתמש"}
                    className={`rounded border px-2 py-1 text-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                      u.blocked
                        ? "hover:bg-muted text-muted-foreground"
                        : "border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    }`}
                  >
                    {isPending ? "..." : u.blocked ? "בטל חסימה" : "חסום"}
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
