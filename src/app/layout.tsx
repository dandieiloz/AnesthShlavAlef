import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";
import { auth, signIn, signOut } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeaderClient } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BetaBanner } from "@/components/BetaBanner";
import { DailyPopupGate } from "@/components/DailyPopupGate";
import { ActivityHeartbeat } from "@/components/ActivityHeartbeat";
import { Toaster } from "@/components/ui/toaster";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { countUnseenAdminResponses } from "@/lib/notifications";
import { getUserProgress } from "@/lib/user-progress";
import { buildProgressMiniViewModel } from "@/components/progress/ProgressBarMini";

const heebo = Heebo({ subsets: ["hebrew", "latin"], variable: "--font-heebo" });
const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "700"],
  variable: "--font-frank-ruhl",
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale).metadata;
  return {
    title: t.appTitle,
    description: t.appDescription,
    icons: {
      icon: "/icon.png",
      apple: "/icon.png",
    },
    openGraph: {
      title: t.appTitle,
      description: t.ogDescription,
      images: [{ url: "/icon.png" }],
    },
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user as { name?: string | null; image?: string | null; role?: string; plan?: string; id?: string } | undefined;
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const [unseenResponseCount, progress] = await Promise.all([
    user?.id ? countUnseenAdminResponses(user.id) : Promise.resolve(0),
    user?.id ? getUserProgress(user.id) : Promise.resolve(null),
  ]);
  const progressMini = progress ? buildProgressMiniViewModel(progress, dict.progress) : null;

  async function handleSignIn() {
    "use server";
    await signIn("google", { redirectTo: "/study" });
  }
  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <html lang={locale} dir={locale === "en" ? "ltr" : "rtl"} className={`${heebo.variable} ${frankRuhl.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var v=localStorage.getItem('perl.fontSizePx');if(v){var n=parseInt(v,10);if(n>=14&&n<=18)document.documentElement.style.fontSize=n+'px';}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen font-sans flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <SiteHeaderClient user={user} unseenResponseCount={unseenResponseCount} signInAction={handleSignIn} signOutAction={handleSignOut} nav={dict.nav} progressMini={progressMini} />
          <BetaBanner t={dict.beta} locale={locale} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <SiteFooter t={dict.footer} />
          <Toaster />
          <DailyPopupGate />
          {user?.id && <ActivityHeartbeat />}
        </ThemeProvider>
      </body>
    </html>
  );
}
