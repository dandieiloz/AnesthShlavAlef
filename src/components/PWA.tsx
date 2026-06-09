"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { usePwaInstall } from "@/components/PwaProvider";

const DISMISS_KEY = "perl.pwaInstallDismissed";

const COPY = {
  he: { title: "התקינו את Perl", body: "גישה מהירה במסך הבית, גם במצב לא מקוון.", install: "התקנה", dismiss: "סגירה" },
  en: { title: "Install Perl", body: "Quick access from your home screen, even offline.", install: "Install", dismiss: "Dismiss" },
} as const;

export function PWA({ locale }: { locale: "he" | "en" }) {
  const { canInstall, promptInstall } = usePwaInstall();
  const [dismissed, setDismissed] = useState(true);
  const t = COPY[locale] ?? COPY.he;

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  async function install() {
    await promptInstall();
  }

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  if (!canInstall || dismissed) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-lg">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t.title}</p>
          <p className="truncate text-xs text-muted-foreground">{t.body}</p>
        </div>
        <button
          type="button"
          onClick={install}
          className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {t.install}
        </button>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t.dismiss}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
