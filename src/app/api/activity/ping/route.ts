import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Throttle: at most one ActivityPing row per user per THROTTLE_MS.
const THROTTLE_MS = 5 * 60 * 1000;

export async function POST() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const sinceCutoff = new Date(Date.now() - THROTTLE_MS);
  // Single round-trip: insert a ping only if the user has none in the last
  // THROTTLE_MS. Uses INSERT ... SELECT WHERE NOT EXISTS so the throttle is
  // enforced atomically without a separate read.
  const rows = await db.$queryRaw<Array<{ id: number }>>`
    INSERT INTO "ActivityPing" ("userId", "createdAt")
    SELECT ${userId}, now()
    WHERE NOT EXISTS (
      SELECT 1 FROM "ActivityPing"
      WHERE "userId" = ${userId} AND "createdAt" >= ${sinceCutoff}
    )
    RETURNING id
  `;

  return NextResponse.json({ logged: rows.length > 0 });
}
