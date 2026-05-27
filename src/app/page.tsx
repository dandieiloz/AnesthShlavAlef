import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signIn } from "@/lib/auth";
import { BookOpen, BrainCircuit, TrendingUp } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/study");

  const locale = await getLocale();
  const t = getDictionary(locale).home;

  const FEATURES = [
    { icon: BookOpen, title: t.feature1Title, description: t.feature1Desc },
    { icon: BrainCircuit, title: t.feature2Title, description: t.feature2Desc },
    { icon: TrendingUp, title: t.feature3Title, description: t.feature3Desc },
  ];

  async function handleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/study" });
  }

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative mx-auto max-w-3xl py-20 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 mx-auto h-full max-w-lg rounded-full bg-primary/5 blur-3xl"
        />
        <div className="mb-6 flex justify-center">
          <Image
            src="/icon.png"
            alt={t.iconAlt}
            width={120}
            height={120}
            className="rounded-2xl shadow-2xl ring-1 ring-white/10"
            priority
          />
        </div>
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
          {t.brandLine}
        </p>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {t.heroTitle}{" "}
          <span className="text-primary">{t.heroTitleHighlight}</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          {t.heroSubtitle}
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <form action={handleSignIn}>
            <Button size="lg" className="gap-2 px-8 shadow-md" type="submit">
              {t.ctaSignIn}
            </Button>
          </form>
        </div>
      </section>

      {/* Feature cards */}
      <section className="pb-16">
        <div className="grid gap-5 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="group transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-3 pt-6">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="font-display text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
