"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Trash2, Upload } from "lucide-react";
import {
  clearPdf,
  getPageOffset,
  getStoredState,
  isFsaSupported,
  pickPdf,
  setPageOffset,
  type LocalPdfState,
} from "@/lib/local-pdf";

type Strings = {
  title: string;
  description: string;
  noneSet: string;
  currentLabel: string;
  choose: string;
  replace: string;
  clear: string;
  fallbackNotice: string;
  errorPick: string;
  offsetLabel: string;
  offsetHelp: string;
};

export function LocalPdfSettingsCard({ t }: { t: Strings }) {
  const [state, setState] = useState<LocalPdfState>({ kind: "none" });
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);
  const [offset, setOffset] = useState<string>("0");

  useEffect(() => {
    setSupported(isFsaSupported());
    void getStoredState().then(setState);
    setOffset(String(getPageOffset()));
  }, []);

  function onOffsetChange(value: string) {
    setOffset(value);
    const n = Number.parseInt(value, 10);
    setPageOffset(Number.isFinite(n) ? n : 0);
  }

  function onPick() {
    setError(null);
    startTransition(() => {
      void (async () => {
        try {
          const next = await pickPdf();
          setState(next);
        } catch (err) {
          const name = (err as { name?: string })?.name;
          if (name !== "AbortError" && (err as Error)?.message !== "cancelled") {
            setError(t.errorPick);
          }
        }
      })();
    });
  }

  function onClear() {
    startTransition(() => {
      void (async () => {
        await clearPdf();
        setState({ kind: "none" });
      })();
    });
  }

  const hasFile = state.kind !== "none";

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.title}</CardTitle>
        <CardDescription>{t.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            {hasFile ? (
              <>
                <p className="text-xs text-muted-foreground">{t.currentLabel}</p>
                <p dir="ltr" className="truncate text-sm font-medium">
                  {state.name}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t.noneSet}</p>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onPick} disabled={isPending} size="sm">
            <Upload className="me-1.5 h-4 w-4" />
            {hasFile ? t.replace : t.choose}
          </Button>
          {hasFile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClear}
              disabled={isPending}
            >
              <Trash2 className="me-1.5 h-4 w-4" />
              {t.clear}
            </Button>
          )}
        </div>

        {/* Manual page offset disabled — auto pagemap (public/textbook-pagemap.json) handles this now.
        <div className="space-y-1.5">
          <Label htmlFor="pdfPageOffset">{t.offsetLabel}</Label>
          <Input
            id="pdfPageOffset"
            type="number"
            inputMode="numeric"
            value={offset}
            onChange={(e) => onOffsetChange(e.target.value)}
            className="w-32"
            dir="ltr"
          />
          <p className="text-xs text-muted-foreground">{t.offsetHelp}</p>
        </div>
        */}

        {!supported && (
          <p className="text-xs text-muted-foreground">{t.fallbackNotice}</p>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
