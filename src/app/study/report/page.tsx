import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { requireCompletedProfile } from "@/lib/auth";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ReportForm } from "./ReportForm";

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.report;
  const params = await searchParams;
  const isRtl = locale === "he";

  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <Link
        href="/study"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className={`h-4 w-4 ${isRtl ? "rotate-180" : ""}`} />
        {t.backToStudy}
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
        {t.intro}
      </div>

      {params.ok === "1" ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="p-5 space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
            <div>
              <p className="font-display font-semibold">{t.successTitle}</p>
              <p className="text-sm text-muted-foreground mt-1">{t.successMessage}</p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/study/report">{t.sendAnother}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {params.err === "1" && (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
              {t.errorInvalid}
            </p>
          )}
          <ReportForm defaultEmail={me.email ?? ""} t={t} />
        </>
      )}
    </div>
  );
}
