"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Screens where the user is answering questions. On these the site chrome
 * (header, banners, footer, tab bar) is hidden and the screen draws its own
 * thin bar instead.
 */
export function isFocusPath(pathname: string): boolean {
  return /^\/quiz\/\d+\/?$/.test(pathname) || pathname.startsWith("/study/scores");
}

/** Renders its children everywhere except on focus screens. */
export function HideInFocus({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isFocusPath(pathname)) return null;
  return <>{children}</>;
}
