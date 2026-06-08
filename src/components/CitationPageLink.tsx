"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { openPdfAtPage, getStoredState, LocalPdfError, type GetFileError } from "@/lib/local-pdf";

type Props = {
  page: number;
  children: React.ReactNode;
  notConfiguredLabel: string;
  permissionDeniedLabel: string;
  notFoundLabel: string;
  setupHref: string;
  setupLabel: string;
};

export function CitationPageLink({
  page,
  children,
  notConfiguredLabel,
  permissionDeniedLabel,
  notFoundLabel,
  setupHref,
  setupLabel,
}: Props) {
  const [error, setError] = useState<GetFileError | null>(null);
  const [hasPdf, setHasPdf] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void getStoredState().then((state) => {
      if (active) setHasPdf(state.kind !== "none");
    });
    return () => {
      active = false;
    };
  }, []);

  async function onClick() {
    setError(null);
    try {
      await openPdfAtPage(page);
    } catch (err) {
      if (err instanceof LocalPdfError) {
        setError(err.code === "unknown" ? "permission-denied" : err.code);
      }
    }
  }

  // Show the "no PDF set" notice automatically when none is configured, even
  // before the user clicks. A click error still wins (e.g. permission/not-found).
  const showNotConfigured = error === "no-handle" || (error === null && hasPdf === false);

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="cursor-pointer underline-offset-2 hover:underline focus:outline-none focus-visible:underline"
      >
        {children}
      </button>
      {showNotConfigured && (
        <span className="ms-1 text-[10px] text-muted-foreground">
          {notConfiguredLabel}{" "}
          <Link
            href={setupHref}
            className="text-primary underline underline-offset-2 hover:no-underline"
          >
            {setupLabel}
          </Link>
        </span>
      )}
      {error === "permission-denied" && (
        <span className="ms-1 text-[10px] text-destructive">{permissionDeniedLabel}</span>
      )}
      {error === "not-found" && (
        <span className="ms-1 text-[10px] text-destructive">{notFoundLabel}</span>
      )}
    </>
  );
}
