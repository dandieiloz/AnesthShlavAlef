"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, User, BookOpen, Settings, Bookmark, CalendarClock, History } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NavUser {
  name?: string | null;
  image?: string | null;
  role?: string;
  plan?: string;
}

interface SiteHeaderClientProps {
  user?: NavUser;
  signInAction: () => Promise<void>;
  signOutAction: () => Promise<void>;
  nav: {
    study: string;
    myQuizzes: string;
    bookmarks: string;
    history: string;
    dashboard: string;
    schedule: string;
    about: string;
    admin: string;
    profile: string;
    signIn: string;
    signOut: string;
    adminBadge: string;
    demoBadge: string;
  };
}

import { Info } from "lucide-react";

function buildNavLinks(nav: SiteHeaderClientProps["nav"]) {
  return [
    { href: "/study",     label: nav.study,      icon: BookOpen },
    { href: "/history",   label: nav.history,    icon: History },
    { href: "/bookmarks", label: nav.bookmarks,  icon: Bookmark },
    { href: "/schedule",  label: nav.schedule,   icon: CalendarClock },
    { href: "/about",     label: nav.about,      icon: Info },
  ];
}

function NavLink({ href, label }: { href: string; label: string }) {
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
    </Link>
  );
}

export function SiteHeaderClient({ user, signInAction, signOutAction, nav }: SiteHeaderClientProps) {
  const NAV_LINKS = buildNavLinks(nav);
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
                <NavLink key={l.href} href={l.href} label={l.label} />
              ))}
              {user.role === "ADMIN" && (
                <NavLink href="/admin" label={nav.admin} />
              )}
            </nav>
          )}

          <ThemeToggle />

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 text-sm font-medium">
                  {user.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={user.image} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <User className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">{user.name}</span>
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
