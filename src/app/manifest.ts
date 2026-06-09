import type { MetadataRoute } from "next";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";

// Served at /manifest.webmanifest
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await getLocale();
  const t = getDictionary(locale).metadata;
  return {
    name: t.appTitle,
    short_name: "Perl",
    description: t.appDescription,
    start_url: "/study",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    dir: locale === "en" ? "ltr" : "rtl",
    lang: locale,
    background_color: "#0a0f1a",
    theme_color: "#0a0f1a",
    categories: ["education", "medical"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
