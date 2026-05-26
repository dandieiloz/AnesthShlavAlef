"use client";
import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { setUserRoleAction } from "./actions";

export type UserRow = {
  id: string;
  name: string | null;
  fullName: string | null;
  email: string;
  image: string | null;
  role: "USER" | "ADMIN";
  hospitalName: string | null;
  residencyYear: number | null;
  createdAt: string;
};

type SortField = "name" | "role" | "hospital" | "residencyYear" | "createdAt";
type SortOrder = "asc" | "desc";

const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", { dateStyle: "short" });

const DEFAULT_SORT_ORDER: Record<SortField, SortOrder> = {
  name: "asc",
  role: "asc",
  hospital: "asc",
  residencyYear: "asc",
  createdAt: "desc",
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
          <SortHeader field="hospital" label="בית חולים" />
          <SortHeader field="residencyYear" label="שנה" align="center" />
          <SortHeader field="createdAt" label="הצטרף" />
          <th className="p-2 text-center text-muted-foreground whitespace-nowrap">פרופיל</th>
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

              {/* Role toggle */}
              <td className="p-2 text-center">
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
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
