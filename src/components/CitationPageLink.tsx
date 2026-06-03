"use client";

import { useState } from "react";
import { openPdfAtPage, LocalPdfError } from "@/lib/local-pdf";

type Props = {
  page: number;
  children: React.ReactNode;
  notConfiguredLabel: string;
  permissionDeniedLabel: string;
  notFoundLabel: string;
};

export function CitationPageLink({
  page,
  children,
  notConfiguredLabel,
  permissionDeniedLabel,
  notFoundLabel,
}: Props) {
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    try {
      await openPdfAtPage(page);
    } catch (err) {
      if (err instanceof LocalPdfError) {
        if (err.code === "no-handle") setError(notConfiguredLabel);
        else if (err.code === "permission-denied") setError(permissionDeniedLabel);
        else if (err.code === "not-found") setError(notFoundLabel);
        else setError(permissionDeniedLabel);
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
      >
        {children}
      </button>
      {error && (
        <span className="ms-1 text-[10px] text-destructive">{error}</span>
      )}
    </>
  );
}
