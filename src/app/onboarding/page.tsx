import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { saveProfileAction } from "./actions";
import { HOSPITALS } from "@/lib/hospitals";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Stethoscope } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { residencyYear: true },
  });
  if (dbUser?.residencyYear) redirect("/study");

  const locale = await getLocale();
  const t = getDictionary(locale).onboarding;

  return (
    <div className="mx-auto max-w-lg py-12 animate-fade-in">
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
              <select
                id="hospitalName"
                name="hospitalName"
                required
                defaultValue=""
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>{t.hospitalPlaceholder}</option>
                {HOSPITALS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
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

            <Button type="submit" className="w-full">{t.continue}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
