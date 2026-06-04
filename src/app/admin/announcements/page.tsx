import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "../AdminNav";
import { AnnouncementsSubNav } from "./AnnouncementsSubNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  toggleAnnouncementAction,
  deleteAnnouncementAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  await requireAdmin();
  const announcements = await db.announcement.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <AdminNav />
      <h1 className="font-display text-2xl font-bold">הודעות</h1>
      <AnnouncementsSubNav />

      <Card>
        <CardHeader>
          <CardTitle>הוספת הודעה חדשה</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAnnouncementAction} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="new-message">תוכן ההודעה</Label>
              <Textarea
                id="new-message"
                name="message"
                required
                rows={2}
                placeholder="טקסט שיוצג בבאנר"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="new-ctaLabel">כיתוב כפתור (אופציונלי)</Label>
                <Input id="new-ctaLabel" name="ctaLabel" placeholder="למשל: למידע נוסף" />
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
        <h2 className="text-lg font-semibold">הודעות קיימות ({announcements.length})</h2>
        {announcements.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין הודעות. הוסף הודעה ראשונה למעלה.</p>
        ) : (
          announcements.map((a) => (
            <Card key={a.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant={a.enabled ? "default" : "secondary"}>
                    {a.enabled ? "פעיל" : "מושבת"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    נוצר: {a.createdAt.toLocaleString("he-IL")}
                  </span>
                </div>
                <form action={updateAnnouncementAction} className="space-y-3">
                  <input type="hidden" name="id" value={a.id} />
                  <div className="space-y-1">
                    <Label htmlFor={`message-${a.id}`}>תוכן</Label>
                    <Textarea
                      id={`message-${a.id}`}
                      name="message"
                      defaultValue={a.message}
                      required
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor={`ctaLabel-${a.id}`}>כיתוב כפתור</Label>
                      <Input
                        id={`ctaLabel-${a.id}`}
                        name="ctaLabel"
                        defaultValue={a.ctaLabel ?? ""}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`ctaHref-${a.id}`}>קישור</Label>
                      <Input
                        id={`ctaHref-${a.id}`}
                        name="ctaHref"
                        defaultValue={a.ctaHref ?? ""}
                      />
                    </div>
                  </div>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="enabled"
                      defaultChecked={a.enabled}
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
                  <form action={toggleAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button type="submit" variant="outline" size="sm">
                      {a.enabled ? "השבת" : "הפעל"}
                    </Button>
                  </form>
                  <form action={deleteAnnouncementAction}>
                    <input type="hidden" name="id" value={a.id} />
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
