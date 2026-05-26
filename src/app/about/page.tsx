import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { EditableSection } from "./AboutEditor";
import { Pencil } from "lucide-react";

const CONTENT_KEYS = ["about_pearl", "about_yoni", "about_daniel"] as const;

const DEFAULTS: Record<string, string> = {
  about_pearl: `לאחר שנשללו ממנה כל המכשור הרפואי וחומרי ההרדמה, ד"ר פרל סיכנה את חייה כדי לבצע ניתוחים בחשאי כשהיא נעזרת בלחישות, באחיזת ידיים ובחמלה עמוקה בלבד כדי ללוות את מטופלותיה מבעד לכאבים מייסרים.

קראנו לפלטפורמה זו על שמה כדי לזכור שאלחוש והרדמה הם הרבה מעבר לפרמקולוגיה ופיזיולוגיה.`,
  about_yoni: `ד"ר יוני חלטניק הוא רופא מרדים ומפתח פלטפורמת Perl.`,
  about_daniel: `ד"ר דניאל רון אילוז הוא רופא מרדים ומפתח פלטפורמת Perl.`,
};

export default async function AboutPage() {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  const isAdmin = user?.role === "ADMIN";

  const rows = await db.siteContent.findMany({
    where: { key: { in: [...CONTENT_KEYS] } },
  });
  const contentMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  function get(key: string) {
    return contentMap[key] ?? DEFAULTS[key] ?? "";
  }

  return (
    <div className="max-w-3xl mx-auto space-y-14 py-4">

      {/* Admin hint */}
      {isAdmin && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-primary">
          <Pencil className="h-3.5 w-3.5 shrink-0" />
          <span>מצב עריכה מנהל — העבר עכבר על כל קטע לחשיפת כפתור העריכה</span>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────── */}
      <div className="text-center space-y-2">
        <h1 className="font-display text-5xl font-bold text-foreground tracking-tight">עלינו</h1>
        <p className="text-muted-foreground text-base">הסיפור מאחורי פלטפורמת Perl</p>
      </div>

      {/* ── Dr. Gisela Pearl ─────────────────────────────────── */}
      <section className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Top accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-l from-primary/60 via-primary to-primary/60" />

        <div className="p-8 space-y-6">
          {/* Section header */}
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
              על שם
            </p>
            <h2 className="font-display text-3xl font-bold text-foreground">
              ד&quot;ר גיזלה פרל
            </h2>
            <p className="text-sm text-muted-foreground">
              1907–1988 &nbsp;·&nbsp; גינקולוגית &nbsp;·&nbsp; שורדת אושוויץ
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Body — editable */}
          <EditableSection
            contentKey="about_pearl"
            value={get("about_pearl")}
            isAdmin={isAdmin}
          />

          {/* Pearl / Perl note */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
            <p className="text-xs text-primary/80 leading-relaxed">
              <span className="font-semibold">Perl</span> — השם נושא שתי משמעויות: פרל, שמה של הרופאה, ו-<span className="font-semibold">Pearl</span> באנגלית — פנינה. שניהם הולמים פלטפורמה שנבנתה מתוך יראת כבוד עמוקה למקצוע.
            </p>
          </div>
        </div>
      </section>

      {/* ── Our Team ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary/70">
            הצוות שלנו
          </p>
          <h2 className="font-display text-3xl font-bold text-foreground">
            המפתחים
          </h2>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">

          {/* Dr. Yoni */}
          <div className="rounded-2xl border bg-card p-6 space-y-4 shadow-sm">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 mb-2">
                <span className="text-xs font-medium text-primary">מרדים</span>
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">
                ד&quot;ר יוני חלטניק
              </h3>
            </div>
            <div className="h-px bg-border" />
            <EditableSection
              contentKey="about_yoni"
              value={get("about_yoni")}
              isAdmin={isAdmin}
            />
          </div>

          {/* Dr. Daniel */}
          <div className="rounded-2xl border bg-card p-6 space-y-4 shadow-sm">
            <div className="space-y-0.5">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 mb-2">
                <span className="text-xs font-medium text-primary">מרדים</span>
              </div>
              <h3 className="font-display text-xl font-bold text-foreground">
                ד&quot;ר דניאל רון אילוז
              </h3>
            </div>
            <div className="h-px bg-border" />
            <EditableSection
              contentKey="about_daniel"
              value={get("about_daniel")}
              isAdmin={isAdmin}
            />
          </div>

        </div>
      </section>

    </div>
  );
}
