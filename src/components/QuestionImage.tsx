"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, ZoomIn } from "lucide-react";

export function QuestionImage({
  url,
  alt,
  className = "",
}: {
  url: string | null | undefined;
  alt: string | null | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Lock body scroll and close on Escape while the lightbox is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!url) return null;

  return (
    <div className={`my-3 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block max-w-full cursor-zoom-in rounded border bg-muted/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={alt ? `${alt} — הגדל תמונה` : "הגדל תמונה"}
      >
        <Image
          src={url}
          alt={alt ?? ""}
          width={800}
          height={600}
          className="max-h-[420px] w-auto max-w-full rounded object-contain"
          unoptimized
        />
        <span className="pointer-events-none absolute bottom-2 end-2 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
          <ZoomIn className="h-3 w-3" />
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt ?? "תמונה"}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 animate-fade-in"
            onClick={() => setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגור"
              className="absolute top-4 end-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={alt ?? ""}
              onClick={(e) => e.stopPropagation()}
              className="max-h-[92vh] max-w-[95vw] cursor-zoom-out rounded object-contain shadow-2xl"
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
