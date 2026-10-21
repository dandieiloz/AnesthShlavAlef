"use client";
import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Sparkles, ArrowLeft, MessageSquareHeart, X } from "lucide-react";

const KEY = "perl:beta-banner-dismissed";
const EVENT = "perl:beta-banner-change";

function read() {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** The default beta banner (shown when there are no announcements), with a close button. */
export function DismissibleBetaBanner({
  t,
  locale,
  closeLabel,
}: {
  t: { label: string; message: string; cta: string };
  locale: "he" | "en";
  closeLabel: string;
}) {
  // Server snapshot is "dismissed" so the banner never flashes for users who closed it.
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  if (dismissed) return null;

  const isRtl = locale === "he";
  function dismiss() {
    try {
      window.localStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <div className="sticky top-14 z-30 w-full border-b border-primary/30 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 pe-10 text-sm sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
            <Sparkles className="h-3 w-3" />
            <span>{t.label}</span>
          </span>
          <span className="font-medium leading-snug text-foreground/90">{t.message}</span>
        </div>
        <Link
          href="/study/report"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-background/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground"
        >
          <MessageSquareHeart className="h-3.5 w-3.5" />
          {t.cta}
          <ArrowLeft className={`h-3 w-3 transition-transform ${isRtl ? "group-hover:-translate-x-0.5" : "rotate-180 group-hover:translate-x-0.5"}`} />
        </Link>
      </div>
      <button
        type="button"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={dismiss}
        className="absolute end-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-foreground/60 hover:bg-primary/20 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
