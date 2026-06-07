import Link from "next/link";
import { Separator } from "@/components/ui/separator";

interface FooterProps {
  t: { tagline: string; credits: string; contribute: string };
}

export function SiteFooter({ t }: FooterProps) {
  return (
    <footer className="mt-auto">
      <Separator />
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-4 text-xs text-muted-foreground">
        <span>{t.tagline}</span>
        <div className="flex items-center gap-4">
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
    </footer>
  );
}
