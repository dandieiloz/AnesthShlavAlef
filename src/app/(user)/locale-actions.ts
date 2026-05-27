"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

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
