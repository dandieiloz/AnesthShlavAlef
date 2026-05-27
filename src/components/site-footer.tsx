import Link from "next/link";
import { Separator } from "@/components/ui/separator";

interface FooterProps {
  t: { tagline: string; credits: string };
}

export function SiteFooter({ t }: FooterProps) {
  return (
    <footer className="mt-auto">
      <Separator />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-muted-foreground">
        <span>{t.tagline}</span>
        <Link href="/about" className="text-center hover:text-foreground transition-colors underline-offset-2 hover:underline">
          {t.credits}
        </Link>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
