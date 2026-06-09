"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";

const SECTION_RE = /^(EXPLANATION|WHY_WRONG_[ABCD]|EVIDENCE_\d+)$/;

const SetSchema = z.object({
  questionId: z.number().int().positive(),
  locale: z.enum(["he", "en"]),
  section: z.string().regex(SECTION_RE),
  sentenceIndex: z.number().int().min(0).max(500),
  colorId: z.number().int().min(1).max(4),
  sentenceHash: z.string().length(16),
  sentenceText: z.string().min(1).max(2000),
});

export async function setHighlightAction(input: z.infer<typeof SetSchema>) {
  const me = await requireUser();
  const data = SetSchema.parse(input);

  await db.sentenceHighlight.upsert({
    where: {
      userId_questionId_locale_section_sentenceIndex: {
        userId: me.id,
        questionId: data.questionId,
        locale: data.locale,
        section: data.section,
        sentenceIndex: data.sentenceIndex,
      },
    },
    create: {
      userId: me.id,
      questionId: data.questionId,
      locale: data.locale,
      section: data.section,
      sentenceIndex: data.sentenceIndex,
      colorId: data.colorId,
      sentenceHash: data.sentenceHash,
      sentenceText: data.sentenceText,
    },
    update: {
      colorId: data.colorId,
      sentenceHash: data.sentenceHash,
      sentenceText: data.sentenceText,
    },
  });

  revalidatePath("/bookmarks");
}

const RemoveSchema = z.object({
  questionId: z.number().int().positive(),
  locale: z.enum(["he", "en"]),
  section: z.string().regex(SECTION_RE),
  sentenceIndex: z.number().int().min(0).max(500),
});

export async function removeHighlightAction(input: z.infer<typeof RemoveSchema>) {
  const me = await requireUser();
  const data = RemoveSchema.parse(input);

  await db.sentenceHighlight.deleteMany({
    where: {
      userId: me.id,
      questionId: data.questionId,
      locale: data.locale,
      section: data.section,
      sentenceIndex: data.sentenceIndex,
    },
  });

  revalidatePath("/bookmarks");
}

// Default highlight color applied when a note is saved on a sentence that has
// no highlight yet (keeps colorId required while letting notes stand alone).
const DEFAULT_NOTE_COLOR = 1;

const NoteSchema = z.object({
  questionId: z.number().int().positive(),
  locale: z.enum(["he", "en"]),
  section: z.string().regex(SECTION_RE),
  sentenceIndex: z.number().int().min(0).max(500),
  note: z.string().max(2000).nullable(),
  sentenceHash: z.string().length(16),
  sentenceText: z.string().min(1).max(2000),
});

export async function setHighlightNoteAction(input: z.infer<typeof NoteSchema>) {
  const me = await requireUser();
  const data = NoteSchema.parse(input);
  const note = data.note && data.note.trim() ? data.note.trim() : null;

  // Upsert: create a default-colored highlight when none exists yet (so a
  // note-only sentence still surfaces under "משפטים מסומנים"); otherwise just
  // update the note text while preserving the existing color.
  await db.sentenceHighlight.upsert({
    where: {
      userId_questionId_locale_section_sentenceIndex: {
        userId: me.id,
        questionId: data.questionId,
        locale: data.locale,
        section: data.section,
        sentenceIndex: data.sentenceIndex,
      },
    },
    create: {
      userId: me.id,
      questionId: data.questionId,
      locale: data.locale,
      section: data.section,
      sentenceIndex: data.sentenceIndex,
      colorId: DEFAULT_NOTE_COLOR,
      sentenceHash: data.sentenceHash,
      sentenceText: data.sentenceText,
      note,
    },
    update: { note },
  });

  revalidatePath("/bookmarks");
}

const RemoveByIdSchema = z.object({ id: z.coerce.number().int().positive() });

export async function removeHighlightByIdAction(formData: FormData) {
  const me = await requireUser();
  const { id } = RemoveByIdSchema.parse({ id: formData.get("id") });
  await db.sentenceHighlight.deleteMany({ where: { id, userId: me.id } });
  revalidatePath("/bookmarks");
}
