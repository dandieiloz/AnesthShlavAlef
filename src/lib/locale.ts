/**
 * Lightweight locale helpers.
 * Locale is stored in a "locale" cookie (client-accessible, SameSite=Lax).
 * "he" is the default; "en" is the only other supported value for now.
 */
import { cookies } from "next/headers";

export type Locale = "he" | "en";
export const SUPPORTED_LOCALES: Locale[] = ["he", "en"];
export const DEFAULT_LOCALE: Locale = "he";

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get("locale")?.value;
  if (value === "en") return "en";
  return DEFAULT_LOCALE;
}
