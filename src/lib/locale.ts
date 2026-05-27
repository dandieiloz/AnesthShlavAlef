/**
 * Lightweight locale helpers.
 *
 * Two independent locale preferences are stored as cookies:
 *   "locale"        — UI language: drives interface strings, RTL/LTR direction, nav labels.
 *   "contentLocale" — Content language: drives question/answer translation via Gemini.
 *
 * Both are client-accessible (SameSite=Lax) and default to "he" (Hebrew).
 * They are configurable only from the Profile page.
 */
import { cookies } from "next/headers";

export type Locale = "he" | "en";
export const SUPPORTED_LOCALES: Locale[] = ["he", "en"];
export const DEFAULT_LOCALE: Locale = "he";

/** UI language — controls interface strings, RTL/LTR, nav labels, etc. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("locale")?.value;
  if (value === "en") return "en";
  return DEFAULT_LOCALE;
}

/** Content language — controls whether questions and answers appear in Hebrew or English. */
export async function getContentLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("contentLocale")?.value;
  if (value === "en") return "en";
  return DEFAULT_LOCALE;
}
