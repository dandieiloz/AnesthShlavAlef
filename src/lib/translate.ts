/**
 * On-demand translation cache.
 *
 * Hebrew is always the source of truth.
 * English text is produced by Gemini acting ONLY as a translator —
 * it must not rephrase, summarise, or add information.
 * Translations are persisted in the Translation table so the API is
 * called at most once per (entity, field, locale) unless the source changes.
 */
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { generateText, FLASH_MODEL } from "@/lib/gemini";

// Medical terminology glossary injected into every translation prompt so that
// Gemini uses the correct English anesthesia terms consistently.
const MEDICAL_GLOSSARY = `
- נשימה ספונטנית → spontaneous breathing
- הרדמה כללית → general anesthesia
- חסם אזורי → regional block
- חסם אפידורלי → epidural block
- חסם ספינלי → spinal block
- לחץ תוך גולגולתי → intracranial pressure (ICP)
- לחץ עורקי ממוצע → mean arterial pressure (MAP)
- ניטור → monitoring
- היפרקפניה → hypercapnia
- היפוקסיה → hypoxia
- אינטובציה → intubation
- לרינגוסקופיה → laryngoscopy
- מסיכת פנים → face mask
- צינורית נשימה → endotracheal tube (ETT)
- רלקסנט שריר → neuromuscular blocking agent (NMBA)
- ניאוסטיגמין → neostigmine
- סוגסאמדקס → sugammadex
- פרופופול → propofol
- קטמין → ketamine
- מידזולם → midazolam
- פנטניל → fentanyl
- מורפין → morphine
- אפינפרין → epinephrine
- נוראפינפרין → norepinephrine
`.trim();

const SYSTEM_PROMPT = `You are a professional medical translator specialising in anaesthesiology.
Your task is to translate Hebrew text into English.

Rules — follow them exactly:
1. Translate faithfully; do NOT rephrase, summarise, add, or omit any information.
2. Preserve all Markdown formatting (**, *, ##, bullet points, numbered lists).
3. Preserve any LaTeX math expressions exactly as-is (e.g. $PaO_2$, \\\\frac{}).
4. Preserve all option labels exactly (e.g. "A.", "1.") and their relative order.
5. Use standard English anesthesiology terminology. Refer to the glossary below for consistency.
6. Return ONLY the translated text — no preamble, no explanation, no quotes.

Glossary:
${MEDICAL_GLOSSARY}`;

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * Returns the translated text for a given entity field.
 * If `locale` is "he" (or the source locale), the `sourceText` is returned as-is.
 *
 * @param entityType  Prisma model name, e.g. "Question"
 * @param entityId    Stringified primary key
 * @param field       Field name, e.g. "stem"
 * @param sourceText  The original Hebrew text
 * @param locale      Target locale, e.g. "en"
 */
export async function getTranslated(
  entityType: string,
  entityId: string,
  field: string,
  sourceText: string,
  locale: string,
): Promise<string> {
  if (!sourceText) return sourceText;
  if (locale === "he") return sourceText;

  const hash = sha256(sourceText);

  // 1. Check cache — valid if source hasn't changed
  const cached = await db.translation.findUnique({
    where: { entityType_entityId_field_locale: { entityType, entityId, field, locale } },
    select: { text: true, sourceHash: true },
  });

  if (cached && cached.sourceHash === hash) {
    return cached.text;
  }

  // 2. Call Gemini as a translator. If Gemini fails (missing API key, quota,
  //    transient outage, etc.) we fall back to the original Hebrew source so
  //    the page can still render rather than crashing the request.
  let text: string;
  try {
    const translated = await generateText(
      FLASH_MODEL,
      SYSTEM_PROMPT,
      `Translate the following Hebrew text to English:\n\n${sourceText}`,
      0.1,
    );
    text = translated.trim();
  } catch (err) {
    console.error(
      `[translate] Failed to translate ${entityType}.${field} (${entityId}) to ${locale}:`,
      err instanceof Error ? err.message : err,
    );
    return sourceText;
  }

  // 3. Upsert into cache
  await db.translation.upsert({
    where: { entityType_entityId_field_locale: { entityType, entityId, field, locale } },
    create: { entityType, entityId, field, locale, sourceHash: hash, text, provider: "gemini" },
    update: { sourceHash: hash, text, provider: "gemini", reviewed: false, createdAt: new Date() },
  });

  return text;
}

/**
 * Translate multiple fields of the same entity in parallel.
 * Returns a record of field → translated text.
 */
export async function getTranslatedFields<T extends string>(
  entityType: string,
  entityId: string,
  fields: Record<T, string>,
  locale: string,
): Promise<Record<T, string>> {
  if (locale === "he") return fields;

  const entries = await Promise.all(
    (Object.entries(fields) as [T, string][]).map(async ([field, text]) => {
      const translated = await getTranslated(entityType, entityId, field, text, locale);
      return [field, translated] as [T, string];
    }),
  );

  return Object.fromEntries(entries) as Record<T, string>;
}

/**
 * Invalidate cached translations for an entity.
 * Call this from admin edit actions or whenever a Hebrew source field is rewritten
 * so that stale English text is removed immediately rather than waiting for the
 * next view-time hash mismatch.
 *
 * @param entityType  Prisma model name, e.g. "Question"
 * @param entityId    Stringified primary key
 * @param fields      Optional list of field names to invalidate. If omitted, ALL cached
 *                    translations for the entity (every field, every locale) are removed.
 */
export async function invalidateTranslations(
  entityType: string,
  entityId: string,
  fields?: string[],
): Promise<void> {
  await db.translation.deleteMany({
    where: {
      entityType,
      entityId,
      ...(fields && fields.length > 0 ? { field: { in: fields } } : {}),
    },
  });
}
