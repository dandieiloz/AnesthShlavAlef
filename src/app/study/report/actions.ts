"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import type { DebugReportKind } from "@prisma/client";

const KINDS = ["BUG", "FEEDBACK", "TECHNICAL"] as const;

const schema = z.object({
  kind: z.enum(KINDS),
  category: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((v) => (v ? v : undefined)),
  description: z.string().trim().min(10).max(4000),
  chapterNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v > 0 && v < 1000), {
      message: "invalid chapter",
    }),
  questionId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isInteger(v) && v > 0), {
      message: "invalid question id",
    }),
  pageUrl: z
    .string()
    .trim()
    .max(2048)
    .optional()
    .transform((v) => (v ? v : undefined)),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function submitDebugReport(formData: FormData) {
  const me = await requireCompletedProfile();

  const parsed = schema.safeParse({
    kind: formData.get("kind"),
    category: formData.get("category") ?? undefined,
    description: formData.get("description"),
    chapterNumber: formData.get("chapterNumber") ?? undefined,
    questionId: formData.get("questionId") ?? undefined,
    pageUrl: formData.get("pageUrl") ?? undefined,
    contactEmail: formData.get("contactEmail") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/study/report?err=1");
  }

  const data = parsed.data;

  await db.debugReport.create({
    data: {
      userId: me.id,
      kind: data.kind as DebugReportKind,
      category: data.category,
      description: data.description,
      chapterNumber: data.chapterNumber,
      questionId: data.questionId,
      pageUrl: data.pageUrl,
      contactEmail: data.contactEmail ?? me.email ?? null,
    },
  });

  redirect("/study/report?ok=1");
}
