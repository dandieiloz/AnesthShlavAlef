import { Separator } from "@/components/ui/separator";

export function SiteFooter() {
  return (
    <footer className="mt-auto">
      <Separator />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-muted-foreground">
        <span>אנסתזיה שלב א׳ · מבוסס Miller&apos;s Anesthesia</span>
        <span>© {new Date().getFullYear()}</span>
      </div>
    </footer>
  );
}
