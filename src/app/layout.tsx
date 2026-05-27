import type { Metadata } from "next";
import { Heebo, Frank_Ruhl_Libre } from "next/font/google";
import "./globals.css";
import { auth, signIn, signOut } from "@/lib/auth";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeaderClient } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Toaster } from "@/components/ui/toaster";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";

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
  const user = session?.user as { name?: string | null; image?: string | null; role?: string } | undefined;
  const locale = await getLocale();
  const dict = getDictionary(locale);

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
      <body className="min-h-screen font-sans flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <SiteHeaderClient user={user} signInAction={handleSignIn} signOutAction={handleSignOut} nav={dict.nav} />
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
          <SiteFooter t={dict.footer} />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
