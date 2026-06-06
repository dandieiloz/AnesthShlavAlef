import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";

export default async function TermsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale).terms;

  const sections = [
    { heading: t.educationalHeading, body: t.educationalBody },
    { heading: t.privacyHeading, body: t.privacyBody },
    { heading: t.marketingHeading, body: t.marketingBody },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-8 animate-fade-in">
      <div className="space-y-2 text-center">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="space-y-4">
        {sections.map((s) => (
          <Card key={s.heading}>
            <CardHeader>
              <CardTitle className="text-lg">{s.heading}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
