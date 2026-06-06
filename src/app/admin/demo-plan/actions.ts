"use server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { invalidateDemoAllowedSources, NULL_SOURCE_SENTINEL } from "@/lib/plan";

export async function setDemoSourceAllowedAction(source: string, allowed: boolean) {
  await requireAdmin();
  if (!source || source.length > 200) throw new Error("מקור לא חוקי");
  if (allowed) {
    await db.demoAllowedSource.upsert({
      where: { source },
      update: {},
      create: { source },
    });
  } else {
    await db.demoAllowedSource.deleteMany({ where: { source } });
  }
  invalidateDemoAllowedSources();
  revalidatePath("/admin/demo-plan");
}

export async function setDemoNullSourceAllowedAction(allowed: boolean) {
  return setDemoSourceAllowedAction(NULL_SOURCE_SENTINEL, allowed);
}

export async function setDemoSourcesAllowedBulkAction(sources: string[], allowed: boolean) {
  await requireAdmin();
  const clean = Array.from(
    new Set(
      sources
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.length <= 200),
    ),
  );
  if (clean.length === 0) return;
  if (allowed) {
    await db.$transaction(
      clean.map((source) =>
        db.demoAllowedSource.upsert({
          where: { source },
          update: {},
          create: { source },
        }),
      ),
    );
  } else {
    await db.demoAllowedSource.deleteMany({ where: { source: { in: clean } } });
  }
  invalidateDemoAllowedSources();
  revalidatePath("/admin/demo-plan");
}
