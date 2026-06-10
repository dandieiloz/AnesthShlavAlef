import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { HOSPITALS } from "@/lib/hospitals";
import { HospitalReminderDialog } from "./HospitalReminderDialog";

export async function HospitalReminderGate() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user
    .findUnique({
      where: { id: userId },
      select: { hospitalName: true, residencyYear: true },
    })
    .catch(() => null);

  // Skip brand-new users still in the sign-up/onboarding flow (they pick a
  // hospital there). `residencyYear` is only set once onboarding completes.
  if (!user || user.residencyYear == null) return null;

  // Only prompt users who haven't picked a hospital yet.
  if (user.hospitalName) return null;

  return <HospitalReminderDialog hospitals={HOSPITALS} />;
}
