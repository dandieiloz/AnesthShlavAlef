"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, User, BookOpen, Settings, Bookmark, CalendarClock, History, MessagesSquare } from "lucide-react";
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
    study: string;
    myQuizzes: string;
    bookmarks: string;
    history: string;
    dashboard: string;
    schedule: string;
    about: string;
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

import { Info } from "lucide-react";

function buildNavLinks(nav: SiteHeaderClientProps["nav"]) {
  return [
    { href: "/study",     label: nav.study,      icon: BookOpen },
    { href: "/history",   label: nav.history,    icon: History },
    { href: "/bookmarks", label: nav.bookmarks,  icon: Bookmark },
    { href: "/schedule",  label: nav.schedule,   icon: CalendarClock },
    { href: "/forum",     label: nav.forum,      icon: MessagesSquare },
    { href: "/about",     label: nav.about,      icon: Info },
  ];
}

function NavLink({ href, label, badge, badgeTitle }: { href: string; label: string; badge?: number; badgeTitle?: string }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={cn(
        "relative text-sm font-medium transition-colors hover:text-foreground",
        active ? "text-foreground" : "text-muted-foreground",
        active && "after:absolute after:inset-x-0 after:-bottom-[1px] after:h-0.5 after:bg-primary after:rounded-full"
      )}
    >
      {label}
      {badge && !active ? (
        <span
          className="absolute -top-2 -end-3 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground ring-2 ring-card"
          title={badgeTitle}
          aria-label={badgeTitle}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

export function SiteHeaderClient({ user, unseenResponseCount = 0, unreadForumCount = 0, signInAction, signOutAction, nav, progressMini }: SiteHeaderClientProps) {
  const pathname = usePathname();
  const NAV_LINKS = buildNavLinks(nav);
  const hasUnseen = unseenResponseCount > 0;
  const responseTitle = nav.adminResponseTitle ?? "יש תגובה מהצוות לדיווח שלך";
  const forumUnreadTitle = nav.forumUnreadTitle ?? "דיונים חדשים בחדר המתמחים";
  const onForum = pathname === "/forum" || pathname.startsWith("/forum/");
  const showForumBadge = unreadForumCount > 0 && !onForum;
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-card/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Image src="/icon.png" alt="Perl" width={32} height={32} className="rounded-lg" />
          <span>Perl</span>
        </Link>

        {/* Nav + actions */}
        <div className="flex items-center gap-1 sm:gap-4">
          {user && (
            <nav className="hidden items-center gap-5 sm:flex">
              {NAV_LINKS.map((l) => (
                <NavLink
                  key={l.href}
                  href={l.href}
                  label={l.label}
                  badge={l.href === "/forum" ? unreadForumCount : undefined}
                  badgeTitle={l.href === "/forum" ? forumUnreadTitle : undefined}
                />
              ))}
              {user.role === "ADMIN" && (
                <NavLink href="/admin" label={nav.admin} />
              )}
            </nav>
          )}

          <FontSizeToggle t={nav.fontSize} />
          <ThemeToggle />

          {user && progressMini && (
            <ProgressBarMini vm={progressMini} />
          )}

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
                      className="absolute -top-0.5 -end-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white ring-2 ring-card"
                      title={responseTitle}
                      aria-label={responseTitle}
                    >
                      {unseenResponseCount}
                    </span>
                  )}
                  {/* Mobile-only cue: the forum link lives inside this menu on small screens. */}
                  {showForumBadge && (
                    <span
                      className="absolute -bottom-0.5 -start-0.5 h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-card sm:hidden"
                      title={forumUnreadTitle}
                      aria-label={forumUnreadTitle}
                    />
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
                        className="w-fit text-xs border-amber-400 text-amber-700 dark:text-amber-300"
                        title="לשדרוג לגישה מלאה פנה למנהלה"
                      >
                        {nav.demoBadge}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  {NAV_LINKS.map((l) => (
                    <DropdownMenuItem key={l.href} asChild>
                      <Link href={l.href} className="flex items-center gap-2 cursor-pointer">
                        <l.icon className="h-4 w-4" />
                        {l.label}
                        {l.href === "/forum" && showForumBadge && (
                          <span
                            className="ms-auto inline-flex items-center justify-center rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground"
                            title={forumUnreadTitle}
                            aria-label={forumUnreadTitle}
                          >
                            {unreadForumCount}
                          </span>
                        )}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                  {user.role === "ADMIN" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                        <Settings className="h-4 w-4" />
                        {nav.admin}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                      <User className="h-4 w-4" />
                      {nav.profile}
                      {hasUnseen && (
                        <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                          {unseenResponseCount} תגובות
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
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
  );
}
