"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

/** Sets the UI language cookie and re-renders the full layout. */
export async function setLocaleAction(locale: "he" | "en") {
  const store = await cookies();
  store.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    httpOnly: false, // readable by client for optimistic toggle
  });
  revalidatePath("/", "layout");
}

/** Sets the content language cookie (questions/answers) and re-renders the full layout. */
export async function setContentLocaleAction(locale: "he" | "en") {
  const store = await cookies();
  store.set("contentLocale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    httpOnly: false, // readable by client for optimistic toggle
  });
  revalidatePath("/", "layout");
}
