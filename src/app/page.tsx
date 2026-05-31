import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signIn } from "@/lib/auth";
import { BookOpen, BrainCircuit, CalendarClock, TrendingUp } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";

const YOUTUBE_VIDEO_ID = "7coXfQWP2_c";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/study");

  const locale = await getLocale();
  const t = getDictionary(locale).home;

  const FEATURES = [
    { icon: BookOpen, title: t.feature1Title, description: t.feature1Desc },
    { icon: BrainCircuit, title: t.feature2Title, description: t.feature2Desc },
    { icon: CalendarClock, title: t.feature3Title, description: t.feature3Desc },
    { icon: TrendingUp, title: t.feature4Title, description: t.feature4Desc },
  ];

  async function handleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/study" });
  }

  return (
    <div className="animate-fade-in">
      {/* Hero */}
      <section className="relative mx-auto -mt-6 max-w-3xl pb-4 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 mx-auto h-full max-w-lg rounded-full bg-primary/5 blur-3xl"
        />
        <div className="mb-2 flex justify-center">
          <Image
            src="/icon.png"
            alt={t.iconAlt}
            width={64}
            height={64}
            className="rounded-2xl shadow-2xl ring-1 ring-white/10"
            priority
          />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-primary">
          {t.brandLine}
        </p>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          {t.heroTitle}{" "}
          <span className="text-primary">{t.heroTitleHighlight}</span>
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {t.heroSubtitle}
        </p>
                <div className="mx-auto my-3 w-full max-w-2xl">
          <div
            className="relative aspect-video overflow-hidden rounded-xl"
            style={{
              WebkitMaskImage:
                "radial-gradient(ellipse at center, #000 55%, transparent 95%)",
              maskImage:
                "radial-gradient(ellipse at center, #000 55%, transparent 95%)",
            }}
          >
            <iframe
              src={`https://www.youtube.com/embed/${YOUTUBE_VIDEO_ID}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1&controls=0&showinfo=0&iv_load_policy=3&disablekb=1&fs=0`}
              title="איך לא חשבנו על זה קודם"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 h-full w-full"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <form action={handleSignIn}>
            <Button size="lg" className="gap-2 px-8 shadow-md" type="submit">
              {t.ctaSignIn}
            </Button>
          </form>
        </div>
      </section>

      {/* Feature cards */}
      <section className="pb-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Card key={title} className="group transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 pt-4">
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
