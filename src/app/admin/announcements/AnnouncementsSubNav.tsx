"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const SUB_TABS = [
  { href: "/admin/announcements", label: "באנר עליון" },
  { href: "/admin/announcements/daily", label: "הודעה יומית" },
] as const;

export function AnnouncementsSubNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Announcements sections" className="overflow-x-auto">
      <div className="inline-flex min-w-full items-center gap-2 rounded-xl border bg-card p-1 text-sm text-muted-foreground sm:min-w-0">
        {SUB_TABS.map((tab) => {
          const active =
            tab.href === "/admin/announcements"
              ? pathname === "/admin/announcements"
              : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
