import { getLocale } from "@/lib/locale";

export const metadata = { title: "Offline" };

export default async function OfflinePage() {
  const locale = await getLocale();
  const t =
    locale === "en"
      ? { title: "You're offline", body: "This page isn't available without a connection. Reconnect and try again." }
      : { title: "אין חיבור לאינטרנט", body: "הדף אינו זמין במצב לא מקוון. התחברו מחדש ונסו שוב." };
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <h1 className="text-2xl font-bold">{t.title}</h1>
      <p className="max-w-md text-muted-foreground">{t.body}</p>
    </div>
  );
}
