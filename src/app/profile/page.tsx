import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { updateProfileAction } from "@/app/(user)/actions";
import { HOSPITALS } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCircle } from "lucide-react";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { LanguageSettingsCard } from "@/components/LanguageSettingsCard";
import { LocalPdfSettingsCard } from "@/components/LocalPdfSettingsCard";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/");

  const [locale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const t = getDictionary(locale).profile;

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { fullName: true, hospitalName: true, residencyYear: true, email: true, role: true },
  });

  if (!user) redirect("/");

  return (
    <div className="mx-auto max-w-lg space-y-6 py-10 animate-fade-in">
      {/* Identity header */}
      <Card>
        <CardContent className="flex items-center gap-4 pt-6">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UserCircle className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="font-display text-lg font-semibold">{user.fullName ?? session.user.name ?? "—"}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
          {user.role === "ADMIN" && <Badge variant="secondary" className="me-auto ms-0">{t.adminBadge}</Badge>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t.updateTitle}</CardTitle>
          <CardDescription>{t.updateDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={updateProfileAction} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">{t.fullName}</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                required
                minLength={2}
                defaultValue={user.fullName ?? ""}
                placeholder={t.fullNamePlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hospitalName">{t.hospitalName}</Label>
              <SearchableSelect
                id="hospitalName"
                name="hospitalName"
                required
                defaultValue={user.hospitalName ?? ""}
                options={HOSPITALS}
                placeholder={t.hospitalPlaceholder}
                searchPlaceholder={t.hospitalPlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="residencyYear">{t.residencyYear}</Label>
              <select
                id="residencyYear"
                name="residencyYear"
                required
                defaultValue={user.residencyYear ?? ""}
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>{t.yearPlaceholder}</option>
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>{t.yearLabels[y]}</option>
                ))}
              </select>
            </div>

            <Button type="submit" className="w-full">{t.saveChanges}</Button>
          </form>
        </CardContent>
      </Card>

      <LanguageSettingsCard
        uiLocale={locale}
        contentLocale={contentLocale}
        isAdmin={user.role === "ADMIN"}
        t={{
          languageTitle: t.languageTitle,
          uiLanguageLabel: t.uiLanguageLabel,
          uiLanguageDesc: t.uiLanguageDesc,
          contentLanguageLabel: t.contentLanguageLabel,
          contentLanguageDesc: t.contentLanguageDesc,
          langHebrew: t.langHebrew,
          langEnglish: t.langEnglish,
          adminOnlyNotice: t.adminOnlyNotice,
        }}
      />

      <LocalPdfSettingsCard
        t={{
          title: t.localPdfTitle,
          description: t.localPdfDesc,
          noneSet: t.localPdfNoneSet,
          currentLabel: t.localPdfCurrent,
          choose: t.localPdfChoose,
          replace: t.localPdfReplace,
          clear: t.localPdfClear,
          fallbackNotice: t.localPdfFallbackNotice,
          errorPick: t.localPdfErrorPick,
          offsetLabel: t.localPdfOffsetLabel,
          offsetHelp: t.localPdfOffsetHelp,
        }}
      />
    </div>
  );
}
