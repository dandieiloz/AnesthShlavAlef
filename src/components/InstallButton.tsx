"use client";

import { Download } from "lucide-react";
import { usePwaInstall } from "@/components/PwaProvider";

/** Footer "Install app" link. Renders nothing unless an install prompt is available. */
export function InstallButton({ label }: { label: string }) {
  const { canInstall, isStandalone, promptInstall } = usePwaInstall();

  if (isStandalone || !canInstall) return null;

  return (
    <button
      type="button"
      onClick={() => promptInstall()}
      className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline-offset-2 hover:underline"
    >
      <Download className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
