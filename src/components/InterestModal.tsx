"use client";
import * as React from "react";
import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Props = {
  t: {
    badge: string;
    title: string;
    intro: string;
    body: string;
    notify: string;
    acknowledge: string;
  };
};

const STORAGE_KEY = "interest-modal-ack-v1";

export function InterestModal({ t }: Props) {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
            <Sparkles className="h-3 w-3" />
            {t.badge}
          </span>
          <DialogTitle className="text-xl">{t.title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/80">
            {t.intro}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm leading-relaxed text-foreground/90">
          <p>{t.body}</p>
          <p className="rounded-md border border-primary/30 bg-primary/10 p-3 text-foreground">
            {t.notify}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleClose} className="w-full sm:w-auto">
            {t.acknowledge}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
