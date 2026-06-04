"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  acknowledgeDailyPopup,
  markDailyPopupShown,
} from "@/lib/daily-popup-actions";

export type DailyPopupDialogProps = {
  id: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaHref: string | null;
};

export function DailyPopupDialog({ id, title, body, ctaLabel, ctaHref }: DailyPopupDialogProps) {
  const [open, setOpen] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    void markDailyPopupShown().catch(() => {});
  }, []);

  function handleAcknowledge() {
    startTransition(async () => {
      try {
        await acknowledgeDailyPopup(id);
      } finally {
        setOpen(false);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {body}
        </div>
        <DialogFooter className="gap-2">
          {ctaHref && ctaLabel ? (
            <Button asChild variant="outline" onClick={() => setOpen(false)}>
              <Link href={ctaHref}>{ctaLabel}</Link>
            </Button>
          ) : null}
          <Button onClick={handleAcknowledge} disabled={isPending}>
            ראיתי, תודה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
