"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_TABS = [
  { href: "/admin", label: "ניהול פרקים" },
  { href: "/admin/queue", label: "מרכז התור" },
  { href: "/admin/questions", label: "שאלות" },
  { href: "/admin/reports", label: "דיווחים" },
  { href: "/admin/debug-reports", label: "דיווחי באג" },
  { href: "/admin/users", label: "משתמשים" },
  { href: "/admin/demo-plan", label: "תוכנית דמו" },
] as const;

function isTabActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin" || pathname.startsWith("/admin/chapters");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminTabsNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="overflow-x-auto">
      <div className="inline-flex min-w-full items-center gap-2 rounded-xl border bg-card p-1 text-sm text-muted-foreground sm:min-w-0">
        {ADMIN_TABS.map((tab) => {
          const active = isTabActive(pathname, tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex flex-1 items-center justify-center whitespace-nowrap rounded-lg px-4 py-2 font-medium transition-colors",
                "hover:bg-muted hover:text-foreground",
                active && "bg-background text-foreground shadow-sm"
              )}
              aria-current={active ? "page" : undefined}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}