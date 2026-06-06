import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { saveProfileAction } from "./actions";
import { HOSPITALS } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Stethoscope } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { InterestModal } from "@/components/InterestModal";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { residencyYear: true },
  });
  if (dbUser?.residencyYear) redirect("/study");

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.onboarding;

  return (
    <div className="mx-auto max-w-lg py-12 animate-fade-in">
      <InterestModal t={dict.interestModal} />
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Stethoscope className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t.personalDetails}</CardTitle>
          <CardDescription>{t.personalDetailsDesc}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveProfileAction} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">{t.fullName}</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                required
                minLength={2}
                placeholder={t.fullNamePlaceholder}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hospitalName">{t.hospitalName}</Label>
              <SearchableSelect
                id="hospitalName"
                name="hospitalName"
                required
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
                defaultValue=""
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>{t.yearPlaceholder}</option>
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>{t.yearLabels[y]}</option>
                ))}
              </select>
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3">
              <input
                id="marketingOptIn"
                name="marketingOptIn"
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-input text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <div className="space-y-1">
                <Label htmlFor="marketingOptIn" className="cursor-pointer font-normal">
                  {t.marketingConsentLabel}
                </Label>
                <p className="text-xs text-muted-foreground">{t.marketingConsentHelp}</p>
              </div>
            </div>

            <Button type="submit" className="w-full">{t.continue}</Button>

            <p className="text-center text-xs text-muted-foreground">
              {t.legalPrefix}
              <Link href="/terms" className="font-medium text-primary hover:underline">
                {t.legalLinkLabel}
              </Link>
              .
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
