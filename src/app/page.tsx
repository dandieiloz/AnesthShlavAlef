import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { signIn } from "@/lib/auth";
import { BookOpen, BrainCircuit, TrendingUp } from "lucide-react";

const FEATURES = [
  {
    icon: BookOpen,
    title: "מבחנים מותאמים אישית",
    description: "בחרו פרקים מתוך Miller's Anesthesia ובנו מבחן ממוקד לפי הצורך שלכם.",
  },
  {
    icon: BrainCircuit,
    title: "הסברים מבוססי מקור",
    description: "כל שאלה מגיעה עם הסבר מפורט המבוסס ישירות על תוכן הספר.",
  },
  {
    icon: TrendingUp,
    title: "מדד מועילות למידה",
    description: "פרקים מדורגים לפי תועלת לימודית כדי שתוכלו להתמקד במה שחשוב.",
  },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/study");

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
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-primary">
          Miller&apos;s Anesthesia · שלב א׳
        </p>
        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          תרגלו אנסתזיה{" "}
          <span className="text-primary">בחכמה</span>
        </h1>
        <p className="mt-5 text-lg text-muted-foreground">
          פלטפורמת שאלות אמריקאיות מבוססת ספר, עם הסברים מפורטים ומדד מועילות
          למידה — בנויה לרזידנטים בדרך לשלב א׳.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <form action={handleSignIn}>
            <Button size="lg" className="gap-2 px-8 shadow-md" type="submit">
              התחילו עכשיו — כניסה עם Google
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
