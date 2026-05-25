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

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/");

  const dbUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { residencyYear: true },
  });
  if (dbUser?.residencyYear) redirect("/study");

  return (
    <div className="mx-auto max-w-lg py-12 animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Stethoscope className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold">השלמת פרופיל</h1>
          <p className="text-sm text-muted-foreground">נשמח להכיר! אנא מלאו את הפרטים כדי להתחיל.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>פרטים אישיים</CardTitle>
          <CardDescription>פרטים אלו ישמשו לסטטיסטיקות ולהתאמת חוויית הלמידה.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={saveProfileAction} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">שם מלא</Label>
              <Input
                id="fullName"
                name="fullName"
                type="text"
                required
                minLength={2}
                placeholder="למשל: ישראל ישראלי"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="hospitalName">שם בית החולים</Label>
              <select
                id="hospitalName"
                name="hospitalName"
                required
                defaultValue=""
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>בחרו בית חולים</option>
                {HOSPITALS.map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="residencyYear">שנת רזידנסי</Label>
              <select
                id="residencyYear"
                name="residencyYear"
                required
                defaultValue=""
                className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="" disabled>בחרו שנה</option>
                <option value="1">שנה א׳</option>
                <option value="2">שנה ב׳</option>
                <option value="3">שנה ג׳</option>
                <option value="4">שנה ד׳</option>
                <option value="5">שנה ה׳</option>
              </select>
            </div>

            <Button type="submit" className="w-full">שמירה והמשך</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
