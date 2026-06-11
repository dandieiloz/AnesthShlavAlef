import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EditableSection } from "./AboutEditor";
import { Pencil, AlertTriangle } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslated } from "@/lib/translate";

const CONTENT_KEYS = ["about_pearl", "about_yoni", "about_daniel"] as const;

const DEFAULTS: Record<string, string> = {
  about_pearl: `לאחר שנשללו ממנה כל המכשור הרפואי וחומרי ההרדמה, ד"ר פרל סיכנה את חייה כדי לבצע ניתוחים בחשאי כשהיא נעזרת בלחישות, באחיזת ידיים ובחמלה עמוקה בלבד כדי ללוות את מטופלותיה מבעד לכאבים מייסרים.

קראנו לפלטפורמה זו על שמה כדי לזכור שאלחוש והרדמה הם הרבה מעבר לפרמקולוגיה ופיזיולוגיה.`,
  about_yoni: `ד"ר יוני חלאטניק הוא רופא מרדים ומפתח פלטפורמת Perl.

Yonatan@khalatnik.com`,
  about_daniel: `ד"ר דניאל רון אילוז הוא רופא מרדים ומפתח פלטפורמת Perl.`,
};

export default async function AboutPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const isAdmin = user?.role === "ADMIN";

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.about;

  const rows = await db.siteContent.findMany({
    where: { key: { in: [...CONTENT_KEYS] } },
  });
  const contentMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  function get(key: string) {
    return contentMap[key] ?? DEFAULTS[key] ?? "";
  }

  // Translate each section's body for non-Hebrew locales
  const translated: Record<string, string> = {};
  for (const key of CONTENT_KEYS) {
    const src = get(key);
    translated[key] = await getTranslated("SiteContent", key, "value", src, locale);
  }

  return (
    <div className="max-w-3xl mx-auto space-y-14 py-4">

      {/* Admin hint */}
      {isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-primary">
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span>{t.adminHint}</span>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-5xl font-bold text-foreground tracking-tight">{t.heroTitle}</h1>
        <p className="text-muted-foreground text-base">{t.heroSubtitle}</p>
      </div>

      {/* ── Disclaimer ───────────────────────────────────────── */}
      <div className="flex items-start gap-3 rounded-2xl border-2 border-red-500/70 bg-red-50 px-5 py-4 shadow-sm dark:border-red-500/60 dark:bg-red-950/30">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <p className="text-sm font-semibold leading-relaxed text-red-700 dark:text-red-300">
          {t.disclaimer}
        </p>
      </div>

      {/* ── Dr. Gisela Pearl ─────────────────────────────────── */}
      <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-l from-primary/60 via-primary to-primary/60" />

        <div className="p-8 space-y-6">
          {/* Section header */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
              {t.namedAfter}
            </p>
            <h2 className="font-display text-3xl font-bold text-foreground">
              {t.pearlName}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t.pearlMeta}
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Body — editable */}
          <EditableSection
            contentKey="about_pearl"
            value={translated.about_pearl}
            isAdmin={isAdmin}
            locale={locale}
            t={t}
          />
        </div>
      </section>

      {/* ── In Memoriam ──────────────────────────────────────── */}
      <section className="rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-900/60 dark:to-zinc-950 shadow-sm overflow-hidden">
        {/* Top accent bar — somber */}
        <div className="h-1 w-full bg-gradient-to-l from-zinc-400/40 via-zinc-600 to-zinc-400/40 dark:from-zinc-600/40 dark:via-zinc-400 dark:to-zinc-600/40" />

        <div className="p-8 space-y-6">
          {/* Eyebrow */}
          <div className="text-center space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-zinc-500 dark:text-zinc-400">
              {t.memorialEyebrow}
            </p>
          </div>

          {/* Portrait + name */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-zinc-300/40 dark:bg-zinc-700/40 blur-md" aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://www.israelhayom.co.il/wp-content/uploads/2026/06/01/01/%D7%A8%D7%92%D7%99%D7%9C%D7%94-%D7%90%D7%95%D7%A8%D7%99-%D7%99%D7%95%D7%A1%D7%A3-%D7%A1%D7%99%D7%9C%D7%91%D7%A1%D7%98%D7%A8-1536x1536.jpg"
                alt={t.memorialImageAlt}
                className="relative h-40 w-40 rounded-full object-cover ring-4 ring-white dark:ring-zinc-900 shadow-lg grayscale"
                loading="lazy"
              />
            </div>
            <div className="text-center space-y-0.5">
              <h2 className="font-display text-2xl font-bold text-foreground">
                {t.memorialName}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t.memorialMeta}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="mx-auto h-px w-24 bg-zinc-300 dark:bg-zinc-700" />

          {/* Body */}
          <p className="text-foreground/90 leading-loose text-[15px] whitespace-pre-line max-w-2xl mx-auto text-center">
            {t.memorialBody}
          </p>
        </div>
      </section>

      {/* ── Our Team ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
            {t.teamEyebrow}
          </p>
          <h2 className="font-display text-3xl font-bold text-foreground">
            {t.teamTitle}
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">

          {/* Dr. Yoni */}
          <div className="group rounded-2xl border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">
            {/* Photo header */}
            <div className="relative h-52 bg-gradient-to-l from-primary/15 via-primary/5 to-transparent">
              <div className="absolute -bottom-32 inset-x-0 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/30 blur-md" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/team/yoni.png"
                    alt={t.yoniName}
                    className="relative h-64 w-64 rounded-full object-cover object-top ring-4 ring-card shadow-lg"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 pt-36 space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                  <span className="text-xs font-medium text-primary">{t.anesthesiologist}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  {t.yoniName}
                </h3>
                <a
                  href="mailto:Yonatan@khalatnik.com"
                  className="block text-sm text-primary hover:underline break-all"
                >
                  Yonatan@khalatnik.com
                </a>
              </div>
              <div className="h-px bg-border" />
              <EditableSection
                contentKey="about_yoni"
                value={translated.about_yoni}
                isAdmin={isAdmin}
                locale={locale}
                t={t}
              />
            </div>
          </div>

          {/* Dr. Daniel */}
          <div className="group rounded-2xl border bg-card shadow-sm overflow-hidden transition-shadow hover:shadow-md">
            {/* Photo header */}
            <div className="relative h-52 bg-gradient-to-l from-primary/15 via-primary/5 to-transparent">
              <div className="absolute -bottom-32 inset-x-0 flex justify-center">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/30 blur-md" aria-hidden="true" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/team/daniel.png"
                    alt={t.danielName}
                    className="relative h-64 w-64 rounded-full object-cover object-top ring-4 ring-card shadow-lg"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>

            <div className="p-6 pt-36 space-y-4">
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
                  <span className="text-xs font-medium text-primary">{t.anesthesiologist}</span>
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">
                  {t.danielName}
                </h3>
                <a
                  href="mailto:dandieiloz@gmail.com"
                  className="block text-sm text-primary hover:underline break-all"
                >
                  dandieiloz@gmail.com
                </a>
              </div>
              <div className="h-px bg-border" />
              <EditableSection
                contentKey="about_daniel"
                value={translated.about_daniel}
                isAdmin={isAdmin}
                locale={locale}
                t={t}
              />
            </div>
          </div>

        </div>
      </section>

    </div>
  );
}
