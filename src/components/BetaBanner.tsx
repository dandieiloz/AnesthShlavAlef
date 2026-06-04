import Link from "next/link";
import { Sparkles, ArrowLeft, MessageSquareHeart } from "lucide-react";
import { db } from "@/lib/db";
import { AnnouncementsRotator } from "./AnnouncementsRotator";

export async function BetaBanner({
  t,
  locale,
}: {
  t: { label: string; message: string; cta: string };
  locale: "he" | "en";
}) {
  const announcements = await db.announcement
    .findMany({
      where: { enabled: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, message: true, ctaLabel: true, ctaHref: true },
    })
    .catch(
      () =>
        [] as { id: string; message: string; ctaLabel: string | null; ctaHref: string | null }[]
    );

  if (announcements.length > 0) {
    return <AnnouncementsRotator items={announcements} locale={locale} />;
  }

  const isRtl = locale === "he";
  return (
    <div className="sticky top-14 z-30 w-full border-b border-primary/30 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/20 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 text-sm sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
            <Sparkles className="h-3 w-3" />
            <span>{t.label}</span>
          </span>
          <span className="text-foreground/90 font-medium leading-snug">{t.message}</span>
        </div>
        <Link
          href="/study/report"
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 bg-background/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
        >
          <MessageSquareHeart className="h-3.5 w-3.5" />
          {t.cta}
          <ArrowLeft className={`h-3 w-3 transition-transform ${isRtl ? "group-hover:-translate-x-0.5" : "rotate-180 group-hover:translate-x-0.5"}`} />
        </Link>
      </div>
    </div>
  );
}
