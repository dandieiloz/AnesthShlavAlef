"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, User, Settings, Home, ListChecks, TrendingUp, MessagesSquare, type LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { FontSizeToggle } from "@/components/font-size-toggle";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { isFocusPath } from "@/components/FocusGate";
import { ProgressBarMini, type ProgressMiniViewModel } from "@/components/progress/ProgressBarMini";

interface NavUser {
  name?: string | null;
  image?: string | null;
  role?: string;
  plan?: string;
}

interface SiteHeaderClientProps {
  user?: NavUser;
  unseenResponseCount?: number;
  unreadForumCount?: number;
  signInAction: () => Promise<void>;
  signOutAction: () => Promise<void>;
  progressMini?: ProgressMiniViewModel | null;
  nav: {
    home: string;
    myQuestions: string;
    progress: string;
    display: string;
    forum: string;
    admin: string;
    profile: string;
    signIn: string;
    signOut: string;
    adminBadge: string;
    demoBadge: string;
    adminResponseTitle?: string;
    forumUnreadTitle?: string;
    fontSize: {
      increase: string;
      decrease: string;
    };
  };
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Path prefixes that count as "inside" this section. */
  match: string[];
}

function buildNavLinks(nav: SiteHeaderClientProps["nav"]): NavItem[] {
  return [
    { href: "/study", label: nav.home, icon: Home, match: ["/study", "/quizzes", "/quiz"] },
    { href: "/my-questions", label: nav.myQuestions, icon: ListChecks, match: ["/my-questions", "/history", "/bookmarks"] },
    { href: "/progress", label: nav.progress, icon: TrendingUp, match: ["/progress", "/schedule", "/dashboard"] },
    { href: "/forum", label: nav.forum, icon: MessagesSquare, match: ["/forum"] },
  ];
}

function isActive(pathname: string, item: NavItem) {
  return item.match.some((p) => pathname === p || pathname.startsWith(p + "/"));
}


function NavLink({ item, active, badge, badgeTitle }: { item: NavItem; active: boolean; badge?: number; badgeTitle?: string }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative text-sm font-medium transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
        active && "after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:rounded-full after:bg-primary",
      )}
    >
      {item.label}
      {badge && !active ? (
        <span
          className="absolute -end-3 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground ring-2 ring-card"
          title={badgeTitle}
          aria-label={badgeTitle}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

function MobileTabBar({ items, pathname, forumBadge, forumTitle }: { items: NavItem[]; pathname: string; forumBadge: number; forumTitle: string }) {
  if (isFocusPath(pathname)) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      aria-label="main"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const active = isActive(pathname, item);
          const showBadge = item.href === "/forum" && forumBadge > 0 && !active;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className="relative">
                  <item.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  {showBadge && (
                    <span
                      className="absolute -end-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground ring-2 ring-card"
                      title={forumTitle}
                      aria-label={forumTitle}
                    >
                      {forumBadge}
                    </span>
                  )}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SiteHeaderClient({ user, unseenResponseCount = 0, unreadForumCount = 0, signInAction, signOutAction, nav, progressMini }: SiteHeaderClientProps) {
  const pathname = usePathname();
  const NAV_LINKS = buildNavLinks(nav);
  const hasUnseen = unseenResponseCount > 0;
  const responseTitle = nav.adminResponseTitle ?? "יש תגובה מהצוות לדיווח שלך";
  const forumUnreadTitle = nav.forumUnreadTitle ?? "דיונים חדשים בחדר המתמחים";
  // Answering questions: the screen draws its own thin bar instead.
  if (isFocusPath(pathname)) return null;
  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
          {/* Logo */}
          <Link href={user ? "/study" : "/"} className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Image src="/icon.png" alt="Perl" width={32} height={32} className="rounded-lg" />
            <span>Perl</span>
          </Link>

          {/* Nav + actions */}
          <div className="flex items-center gap-1 sm:gap-4">
            {user && (
              <nav className="hidden items-center gap-6 sm:flex">
                {NAV_LINKS.map((l) => (
                  <NavLink
                    key={l.href}
                    item={l}
                    active={isActive(pathname, l)}
                    badge={l.href === "/forum" ? unreadForumCount : undefined}
                    badgeTitle={l.href === "/forum" ? forumUnreadTitle : undefined}
                  />
                ))}
                {user.role === "ADMIN" && (
                  <NavLink item={{ href: "/admin", label: nav.admin, icon: Settings, match: ["/admin"] }} active={pathname.startsWith("/admin")} />
                )}
              </nav>
            )}

            {/* On phones these live in the avatar menu to keep the bar uncluttered. */}
            <div className={cn("items-center gap-1 sm:gap-4", user ? "hidden sm:flex" : "flex")}>
              <FontSizeToggle t={nav.fontSize} />
              <ThemeToggle />
            </div>

            {user && progressMini && <ProgressBarMini vm={progressMini} />}

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="relative gap-2 text-sm font-medium">
                    {user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={user.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{user.name}</span>
                    {hasUnseen && (
                      <span
                        className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white ring-2 ring-card"
                        title={responseTitle}
                        aria-label={responseTitle}
                      >
                        {unseenResponseCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-medium">{user.name}</p>
                      {user.role === "ADMIN" && (
                        <Badge variant="secondary" className="w-fit text-xs">{nav.adminBadge}</Badge>
                      )}
                      {user.role !== "ADMIN" && user.plan === "DEMO" && (
                        <Badge
                          variant="outline"
                          className="w-fit border-amber-400 text-xs text-amber-700 dark:text-amber-300"
                          title="לשדרוג לגישה מלאה פנה למנהלה"
                        >
                          {nav.demoBadge}
                        </Badge>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="flex items-center justify-between gap-2 px-2 py-1 sm:hidden">
                    <span className="text-xs text-muted-foreground">{nav.display}</span>
                    <div className="flex items-center gap-1">
                      <FontSizeToggle t={nav.fontSize} />
                      <ThemeToggle />
                    </div>
                  </div>
                  <DropdownMenuSeparator className="sm:hidden" />
                  <DropdownMenuGroup>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex cursor-pointer items-center gap-2">
                        <User className="h-4 w-4" />
                        {nav.profile}
                        {hasUnseen && (
                          <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                            {unseenResponseCount} תגובות
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                    {user.role === "ADMIN" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex cursor-pointer items-center gap-2">
                          <Settings className="h-4 w-4" />
                          {nav.admin}
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <form action={signOutAction} className="w-full">
                      <button type="submit" className="flex w-full items-center gap-2 text-destructive">
                        <LogOut className="h-4 w-4" />
                        {nav.signOut}
                      </button>
                    </form>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <form action={signInAction}>
                <Button type="submit" size="sm" className="gap-2">
                  {nav.signIn}
                </Button>
              </form>
            )}
          </div>
        </div>
      </header>
      {user && (
        <MobileTabBar items={NAV_LINKS} pathname={pathname} forumBadge={unreadForumCount} forumTitle={forumUnreadTitle} />
      )}
    </>
  );
}
