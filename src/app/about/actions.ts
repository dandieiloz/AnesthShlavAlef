"use server";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ALLOWED_KEYS = ["about_pearl", "about_yoni", "about_daniel"] as const;
type ContentKey = (typeof ALLOWED_KEYS)[number];

function isAllowedKey(key: string): key is ContentKey {
  return (ALLOWED_KEYS as readonly string[]).includes(key);
}

export async function updateSiteContentAction(key: string, value: string) {
  await requireAdmin();
  if (!isAllowedKey(key)) throw new Error("Invalid content key");
  const trimmed = z.string().min(1).max(10000).parse(value.trim());
  await db.siteContent.upsert({
    where: { key },
    update: { value: trimmed },
    create: { key, value: trimmed },
  });
  revalidatePath("/about");
}
