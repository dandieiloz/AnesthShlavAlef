import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signOut } from "@/lib/auth";
import { Ban } from "lucide-react";

export default function BlockedPage() {
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <div className="animate-fade-in mx-auto max-w-lg py-16 text-center" dir="rtl">
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="font-display text-2xl font-bold">החשבון נחסם</h1>
          <p className="text-muted-foreground">
            הגישה לחשבון זה נחסמה. אם לדעתך מדובר בטעות, אנא צרו קשר עם הצוות.
          </p>
          <form action={handleSignOut}>
            <Button type="submit" variant="outline">
              התנתקות
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
