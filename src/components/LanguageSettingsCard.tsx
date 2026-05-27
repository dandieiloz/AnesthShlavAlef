"use client";

import { useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { setLocaleAction, setContentLocaleAction } from "@/app/(user)/locale-actions";

interface LanguageSettingsCardProps {
  uiLocale: "he" | "en";
  contentLocale: "he" | "en";
  isAdmin: boolean;
  t: {
    languageTitle: string;
    uiLanguageLabel: string;
    uiLanguageDesc: string;
    contentLanguageLabel: string;
    contentLanguageDesc: string;
    langHebrew: string;
    langEnglish: string;
    adminOnlyNotice: string;
  };
}

function LocaleButtonGroup({
  current,
  onSelect,
  isPending,
  heLabel,
  enLabel,
}: {
  current: "he" | "en";
  onSelect: (locale: "he" | "en") => void;
  isPending: boolean;
  heLabel: string;
  enLabel: string;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => onSelect("he")}
        className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
          current === "he"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        }`}
      >
        {heLabel}
      </button>
      <button
        type="button"
        disabled={isPending}
        onClick={() => onSelect("en")}
        className={`rounded-md border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${
          current === "en"
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
        }`}
      >
        {enLabel}
      </button>
    </div>
  );
}

export function LanguageSettingsCard({ uiLocale, contentLocale, isAdmin, t }: LanguageSettingsCardProps) {
  const [uiPending, startUiTransition] = useTransition();
  const [contentPending, startContentTransition] = useTransition();

  function handleUiLocale(locale: "he" | "en") {
    // Optimistic cookie write for instant feel
    document.cookie = `locale=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startUiTransition(() => setLocaleAction(locale));
  }

  function handleContentLocale(locale: "he" | "en") {
    document.cookie = `contentLocale=${locale};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    startContentTransition(() => setContentLocaleAction(locale));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.languageTitle}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* UI language */}
        <div className="space-y-2">
          <p className="text-sm font-medium">{t.uiLanguageLabel}</p>
          <CardDescription className="text-xs">{t.uiLanguageDesc}</CardDescription>
          <LocaleButtonGroup
            current={uiLocale}
            onSelect={handleUiLocale}
            isPending={uiPending}
            heLabel={t.langHebrew}
            enLabel={t.langEnglish}
          />
        </div>

        {/* Content language — admin only */}
        {isAdmin && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{t.contentLanguageLabel}</p>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                {t.adminOnlyNotice}
              </span>
            </div>
            <CardDescription className="text-xs">{t.contentLanguageDesc}</CardDescription>
            <LocaleButtonGroup
              current={contentLocale}
              onSelect={handleContentLocale}
              isPending={contentPending}
              heLabel={t.langHebrew}
              enLabel={t.langEnglish}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
