"use client";
import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

// Number of client-side route changes since the app loaded in this tab. When
// it's above zero, the previous history entry is a page of this app.
let inAppNavigations = 0;
let lastPath: string | null = null;

/** Mounted once in the root layout; counts in-app navigations. */
export function NavigationTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) inAppNavigations++;
    lastPath = pathname;
  }, [pathname]);
  return null;
}

/**
 * "Back" link that returns to wherever the user came from inside the app, and
 * falls back to `fallbackHref` when the page was opened directly (new tab,
 * shared link, reload).
 */
export function BackLink({
  fallbackHref,
  label,
  dir,
  className,
}: {
  fallbackHref: string;
  label: string;
  dir: "rtl" | "ltr";
  className?: string;
}) {
  const router = useRouter();
  const Icon = dir === "rtl" ? ArrowRight : ArrowLeft;

  function onClick(e: React.MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (inAppNavigations > 0) {
      e.preventDefault();
      router.back();
    }
  }

  return (
    <Link
      href={fallbackHref}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
