"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Megaphone, ArrowLeft } from "lucide-react";

export type AnnouncementItem = {
  id: string;
  message: string;
  ctaLabel: string | null;
  ctaHref: string | null;
};

const ROTATE_MS = 6000;
const FADE_MS = 400;

export function AnnouncementsRotator({
  items,
  locale,
}: {
  items: AnnouncementItem[];
  locale: "he" | "en";
}) {
  const isRtl = locale === "he";
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const interval = setInterval(() => {
      setVisible(false);
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, FADE_MS);
      return () => clearTimeout(t);
    }, ROTATE_MS);
    return () => clearInterval(interval);
  }, [items.length, paused]);

  if (items.length === 0) return null;
  const current = items[Math.min(index, items.length - 1)];
  const tutorialSrc = "https://www.youtube-nocookie.com/embed/padZfSZ10xM?autoplay=1&playsinline=1&rel=0&modestbranding=1&controls=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0";

  return (
    <div
      className="sticky top-14 z-30 w-full border-b border-primary/30 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 backdrop-blur-md shadow-sm"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:justify-between">
        <div
          className="flex items-center gap-2 min-w-0 transition-opacity"
          style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
        >
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
            <Megaphone className="h-3 w-3" />
            <span>הודעה</span>
          </span>
          <span className="text-foreground/90 font-medium leading-snug">{current.message}</span>
        </div>
        {current.ctaHref && current.ctaLabel ? (
          <Link
            href={current.ctaHref}
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-background/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            style={{ opacity: visible ? 1 : 0, transitionDuration: `${FADE_MS}ms` }}
          >
            {current.ctaLabel}
            <ArrowLeft
              className={`h-3 w-3 transition-transform group-hover:-translate-x-0.5 ${
                isRtl ? "" : "rotate-180 group-hover:translate-x-0.5"
              }`}
            />
          </Link>
        ) : null}
      </div>
      {items.length > 1 ? (
        <div className="absolute bottom-0 inset-x-0 flex justify-center gap-1 pb-0.5 pointer-events-none">
          {items.map((it, i) => (
            <span
              key={it.id}
              className={`h-1 w-1 rounded-full transition-colors ${
                i === index ? "bg-primary" : "bg-primary/30"
              }`}
            />
          ))}
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-6xl px-4 pb-2 pt-1">
        <details
          className="rounded-lg border border-primary/30 bg-background/70"
          onToggle={(e) => setVideoOpen((e.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-foreground marker:content-none">
            איך לפתוח ציטוטים ישירות מהספר
          </summary>
          <div className="border-t border-primary/20 p-2">
            <div className="relative aspect-video overflow-hidden rounded-md bg-black">
              {videoOpen ? (
                <iframe
                  src={tutorialSrc}
                  title="איך לפתוח ציטוטים ישירות מהספר"
                  className="absolute inset-0 h-full w-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen={false}
                />
              ) : null}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}
