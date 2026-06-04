import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "../../AdminNav";
import { AnnouncementsSubNav } from "../AnnouncementsSubNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createDailyPopupAction,
  updateDailyPopupAction,
  toggleDailyPopupAction,
  deleteDailyPopupAction,
  resetAcksDailyPopupAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminDailyPopupsPage() {
  await requireAdmin();
  const popups = await db.dailyPopup.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { acks: true } } },
  });

  return (
    <div className="space-y-6">
      <AdminNav />
      <h1 className="font-display text-2xl font-bold">הודעות</h1>
      <AnnouncementsSubNav />

      <Card>
        <CardHeader>
          <CardTitle>הוספת הודעה יומית חדשה</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            הודעה יומית מופיעה כחלון קופץ פעם ביום למשתמשים מחוברים. לחיצה על &quot;ראיתי, תודה&quot;
            תסיר אותה לצמיתות עבור אותו משתמש.
          </p>
          <form action={createDailyPopupAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-title">כותרת</Label>
              <Input id="new-title" name="title" required placeholder="למשל: עדכון חדש באפליקציה" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-body">תוכן</Label>
              <Textarea
                id="new-body"
                name="body"
                required
                rows={4}
                placeholder="הטקסט שיוצג בחלון הקופץ"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-ctaLabel">כיתוב כפתור (אופציונלי)</Label>
                <Input id="new-ctaLabel" name="ctaLabel" placeholder="למשל: קרא עוד" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="new-ctaHref">קישור (אופציונלי)</Label>
                <Input id="new-ctaHref" name="ctaHref" placeholder="/about או https://..." />
              </div>
            </div>
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" name="enabled" defaultChecked className="h-4 w-4" />
              <span>פעיל</span>
            </label>
            <div>
              <Button type="submit">הוסף</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">הודעות קיימות ({popups.length})</h2>
        {popups.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין הודעות יומיות. הוסף הודעה ראשונה למעלה.</p>
        ) : (
          popups.map((p) => (
            <Card key={p.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={p.enabled ? "default" : "secondary"}>
                      {p.enabled ? "פעיל" : "מושבת"}
                    </Badge>
                    <Badge variant="outline">{p._count.acks} אישורים</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    נוצר: {p.createdAt.toLocaleString("he-IL")}
                  </span>
                </div>
                <form action={updateDailyPopupAction} className="space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="space-y-1">
                    <Label htmlFor={`title-${p.id}`}>כותרת</Label>
                    <Input id={`title-${p.id}`} name="title" defaultValue={p.title} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`body-${p.id}`}>תוכן</Label>
                    <Textarea
                      id={`body-${p.id}`}
                      name="body"
                      defaultValue={p.body}
                      required
                      rows={4}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`ctaLabel-${p.id}`}>כיתוב כפתור</Label>
                      <Input
                        id={`ctaLabel-${p.id}`}
                        name="ctaLabel"
                        defaultValue={p.ctaLabel ?? ""}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`ctaHref-${p.id}`}>קישור</Label>
                      <Input
                        id={`ctaHref-${p.id}`}
                        name="ctaHref"
                        defaultValue={p.ctaHref ?? ""}
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={p.enabled}
                      className="h-4 w-4"
                    />
                    <span>פעיל</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" size="sm">
                      שמור
                    </Button>
                  </div>
                </form>
                <div className="flex flex-wrap gap-2 border-t pt-3">
                  <form action={toggleDailyPopupAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="outline" size="sm">
                      {p.enabled ? "השבת" : "הפעל"}
                    </Button>
                  </form>
                  <form action={resetAcksDailyPopupAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="outline" size="sm">
                      אפס אישורים (הצג שוב לכולם)
                    </Button>
                  </form>
                  <form action={deleteDailyPopupAction}>
                    <input type="hidden" name="id" value={p.id} />
                    <Button type="submit" variant="destructive" size="sm">
                      מחק
                    </Button>
                  </form>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
