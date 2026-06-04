import { getDailyPopupForCurrentUser } from "@/lib/daily-popup";
import { DailyPopupDialog } from "./DailyPopupDialog";

export async function DailyPopupGate() {
  const popup = await getDailyPopupForCurrentUser().catch(() => null);
  if (!popup) return null;
  return (
    <DailyPopupDialog
      id={popup.id}
      title={popup.title}
      body={popup.body}
      ctaLabel={popup.ctaLabel}
      ctaHref={popup.ctaHref}
    />
  );
}
