import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";
import { updateProfileAction } from "@/app/(user)/actions";
import { HOSPITALS } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserCircle, MessageSquare, Flag, Bug } from "lucide-react";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { LanguageSettingsCard } from "@/components/LanguageSettingsCard";
import { LocalPdfSettingsCard } from "@/components/LocalPdfSettingsCard";

const DATE_FMT = new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" });

function statusPill(status: "OPEN" | "RESOLVED" | "REJECTED") {
  if (status === "RESOLVED") {
    return { label: "טופל", cls: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-200" };
  }
  if (status === "REJECTED") {
    return { label: "נדחה", cls: "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200" };
  }
  return { label: "ממתין", cls: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200" };
}

const KIND_LABEL: Record<string, string> = {
  BUG: "באג",
  FEEDBACK: "משוב",
  TECHNICAL: "טכני",
};

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

  const [answerReports, debugReports] = await Promise.all([
    db.answerReport.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        questionId: true,
        explanation: true,
        status: true,
        adminResponse: true,
        adminResponseAt: true,
        createdAt: true,
        question: { select: { stem: true, chapter: { select: { number: true } } } },
      },
    }),
    db.debugReport.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        kind: true,
        category: true,
        description: true,
        status: true,
        adminResponse: true,
        adminResponseAt: true,
        createdAt: true,
        questionId: true,
        chapterNumber: true,
      },
    }),
  ]);
  const answeredCount =
    answerReports.filter((r) => r.adminResponse).length +
    debugReports.filter((r) => r.adminResponse).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-10 animate-fade-in">
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

      {(answerReports.length > 0 || debugReports.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span>הדיווחים שלי</span>
              {answeredCount > 0 && (
                <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200">
                  <MessageSquare className="h-3 w-3" />
                  {answeredCount} תגובות חדשות מהצוות
                </Badge>
              )}
            </CardTitle>
            <CardDescription>דיווחים ששלחת על תשובות שגויות, באגים ומשוב, ותגובות הצוות.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {answerReports.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  <Flag className="h-4 w-4" />
                  דיווחים על תשובות שגויות
                </h3>
                <ul className="space-y-3">
                  {answerReports.map((r) => {
                    const pill = statusPill(r.status);
                    return (
                      <li key={`a-${r.id}`} className="rounded-lg border bg-card p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className={`rounded px-2 py-0.5 ${pill.cls}`}>{pill.label}</span>
                          {r.adminResponse && (
                            <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200">
                              <MessageSquare className="h-3 w-3" />
                              תגובה מהצוות
                            </Badge>
                          )}
                          <span>פרק {r.question.chapter.number}</span>
                          <span>· {DATE_FMT.format(r.createdAt)}</span>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm">
                          <span className="font-medium">השאלה: </span>
                          {r.question.stem}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                          <span className="font-semibold">הדיווח שלך: </span>
                          {r.explanation}
                        </p>
                        {r.adminResponse && (
                          <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-2 text-xs dark:border-emerald-700 dark:bg-emerald-950/30">
                            <div className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-200">
                              <MessageSquare className="h-3 w-3" />
                              תגובת הצוות {r.adminResponseAt && `· ${DATE_FMT.format(r.adminResponseAt)}`}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-emerald-900 dark:text-emerald-100">{r.adminResponse}</p>
                          </div>
                        )}
                        <div className="mt-2">
                          <Link
                            href={`/history/${r.questionId}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            פתח את השאלה →
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {debugReports.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
                  <Bug className="h-4 w-4" />
                  דיווחי באג ומשוב
                </h3>
                <ul className="space-y-3">
                  {debugReports.map((r) => {
                    const pill = statusPill(r.status);
                    return (
                      <li key={`d-${r.id}`} className="rounded-lg border bg-card p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className={`rounded px-2 py-0.5 ${pill.cls}`}>{pill.label}</span>
                          {r.adminResponse && (
                            <Badge className="gap-1 bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-200">
                              <MessageSquare className="h-3 w-3" />
                              תגובה מהצוות
                            </Badge>
                          )}
                          <span>{KIND_LABEL[r.kind] ?? r.kind}</span>
                          {r.category && <span>· {r.category}</span>}
                          {r.chapterNumber && <span>· פרק {r.chapterNumber}</span>}
                          <span>· {DATE_FMT.format(r.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap rounded bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                          <span className="font-semibold">הדיווח שלך: </span>
                          {r.description}
                        </p>
                        {r.adminResponse && (
                          <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-2 text-xs dark:border-emerald-700 dark:bg-emerald-950/30">
                            <div className="flex items-center gap-1 font-semibold text-emerald-800 dark:text-emerald-200">
                              <MessageSquare className="h-3 w-3" />
                              תגובת הצוות {r.adminResponseAt && `· ${DATE_FMT.format(r.adminResponseAt)}`}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-emerald-900 dark:text-emerald-100">{r.adminResponse}</p>
                          </div>
                        )}
                        {r.questionId && (
                          <div className="mt-2">
                            <Link
                              href={`/history/${r.questionId}`}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              פתח את השאלה →
                            </Link>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
