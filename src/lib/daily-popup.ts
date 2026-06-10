import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export type DailyPopupView = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaHref: string | null;
};

function utcDayOfYear(d: Date): number {
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const now = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.floor((now - start) / 86_400_000);
}

function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

export async function getDailyPopupForCurrentUser(): Promise<DailyPopupView | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user
    .findUnique({
      where: { id: userId },
      select: { lastDailyPopupAt: true, residencyYear: true },
    })
    .catch(() => null);
  if (!user) return null;

  // Don't interrupt the sign-up/onboarding flow with popups. `residencyYear`
  // is only set once onboarding completes.
  if (user.residencyYear == null) return null;

  const now = new Date();
  if (user.lastDailyPopupAt && isSameUtcDay(user.lastDailyPopupAt, now)) {
    return null;
  }

  const [popups, acks] = await Promise.all([
    db.dailyPopup.findMany({
      where: { enabled: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, body: true, ctaLabel: true, ctaHref: true },
    }),
    db.dailyPopupAck.findMany({
      where: { userId },
      select: { popupId: true },
    }),
  ]);

  const ackedSet = new Set(acks.map((a) => a.popupId));
  const eligible = popups.filter((p) => !ackedSet.has(p.id));
  if (eligible.length === 0) return null;

  const idx = utcDayOfYear(now) % eligible.length;
  return eligible[idx];
}
