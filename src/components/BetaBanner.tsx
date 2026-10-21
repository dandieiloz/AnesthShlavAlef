import { db } from "@/lib/db";
import { AnnouncementsRotator } from "./AnnouncementsRotator";
import { DismissibleBetaBanner } from "./DismissibleBetaBanner";

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

  return <DismissibleBetaBanner t={t} locale={locale} closeLabel={locale === "he" ? "סגירה" : "Close"} />;
}
