import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { InstallButton } from "@/components/InstallButton";
import { Disclaimer } from "@/components/disclaimer";

interface FooterProps {
  t: { tagline: string; credits: string; contribute: string; install: string; disclaimer: string };
}

export function SiteFooter({ t }: FooterProps) {
  return (
    <footer className="mt-auto">
      <Separator />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 text-xs text-muted-foreground">
        <span>{t.tagline}</span>
        <div className="flex items-center gap-4">
          <InstallButton label={t.install} />
          <Link
            href="/contribute"
            className="hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            {t.contribute}
          </Link>
          <Link
            href="/about"
            className="text-center hover:text-foreground transition-colors underline-offset-2 hover:underline"
          >
            {t.credits}
          </Link>
        </div>
        <span>© {new Date().getFullYear()}</span>
      </div>
      <Disclaimer text={t.disclaimer} className="mx-auto max-w-6xl px-4" />
      <div className="mx-auto max-w-6xl px-4 pb-4 text-[10px] text-muted-foreground/70">
        {process.env.NEXT_PUBLIC_APP_VERSION}
      </div>
    </footer>
  );
}
