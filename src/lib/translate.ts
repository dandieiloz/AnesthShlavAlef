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
import { Type, type Schema } from "@google/genai";
import { db } from "@/lib/db";
import { generateText, generateJson, FLASH_MODEL } from "@/lib/gemini";

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
 * Translate multiple fields of the same entity in a SINGLE Gemini call.
 *
 * This is the preferred entry point for translating an entity (question, answer,
 * etc.) because it collapses what would otherwise be N parallel API calls into
 * one batched request — dramatically reducing user-perceived latency.
 *
 * Behaviour:
 *  - Hebrew source → returned as-is.
 *  - Cached fields whose source hash matches are reused (no API call).
 *  - Only uncached / stale fields are sent to Gemini, in one structured call.
 *  - On Gemini failure the Hebrew source is returned for the failed fields and
 *    nothing is written to the cache (so the next render will retry).
 */
export async function getTranslatedFields<T extends string>(
  entityType: string,
  entityId: string,
  fields: Record<T, string>,
  locale: string,
): Promise<Record<T, string>> {
  if (locale === "he") return fields;

  const fieldNames = Object.keys(fields) as T[];
  if (fieldNames.length === 0) return fields;

  const result = { ...fields };
  const hashes: Partial<Record<T, string>> = {};
  const toTranslate: T[] = [];

  // Bulk-load any existing cache rows for these fields in one query.
  const cached = await db.translation.findMany({
    where: {
      entityType,
      entityId,
      locale,
      field: { in: fieldNames as string[] },
    },
    select: { field: true, text: true, sourceHash: true },
  });
  const cacheMap = new Map(cached.map((c) => [c.field, c]));

  for (const f of fieldNames) {
    const src = fields[f];
    if (!src) continue; // empty source → keep empty
    const h = sha256(src);
    hashes[f] = h;
    const c = cacheMap.get(f);
    if (c && c.sourceHash === h) {
      result[f] = c.text;
    } else {
      toTranslate.push(f);
    }
  }

  if (toTranslate.length === 0) return result;

  // Build a JSON-schema response with one string property per field.
  const schema: Schema = {
    type: Type.OBJECT,
    properties: Object.fromEntries(
      toTranslate.map((f) => [f, { type: Type.STRING }]),
    ) as Record<string, Schema>,
    required: toTranslate as string[],
  };

  const inputObj: Record<string, string> = {};
  for (const f of toTranslate) inputObj[f] = fields[f];

  let translated: Record<string, string>;
  try {
    translated = await generateJson<Record<string, string>>(
      FLASH_MODEL,
      SYSTEM_PROMPT,
      `Translate each value of the following JSON object from Hebrew to English. ` +
        `Return a JSON object with the EXACT same keys, where each value is the English translation of the corresponding Hebrew value. ` +
        `Apply all translation rules to each value independently.\n\n` +
        JSON.stringify(inputObj, null, 2),
      schema,
      0.1,
    );
  } catch (err) {
    console.error(
      `[translate] Batched translation failed for ${entityType} ${entityId} (${toTranslate.length} fields) to ${locale}:`,
      err instanceof Error ? err.message : err,
    );
    // Leave result[f] = source for failed fields; do NOT cache.
    return result;
  }

  // Persist each translated field. Fall back to source for any that came back empty.
  await Promise.all(
    toTranslate.map((f) => {
      const text = (translated[f] ?? "").trim();
      const hash = hashes[f];
      if (!text || !hash) {
        // Bad response for this field — keep source, skip cache.
        return Promise.resolve();
      }
      result[f] = text;
      return db.translation.upsert({
        where: { entityType_entityId_field_locale: { entityType, entityId, field: f, locale } },
        create: { entityType, entityId, field: f, locale, sourceHash: hash, text, provider: "gemini" },
        update: { sourceHash: hash, text, provider: "gemini", reviewed: false, createdAt: new Date() },
      });
    }),
  );

  return result;
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
