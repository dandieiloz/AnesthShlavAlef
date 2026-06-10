"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createThreadAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";

type Strings = {
  newTopic: string;
  newTopicTitle: string;
  titleLabel: string;
  titlePlaceholder: string;
  bodyLabel: string;
  bodyPlaceholder: string;
  post: string;
  cancel: string;
};

export function NewThreadForm({ t }: { t: Strings }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createThreadAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      formRef.current?.reset();
      setOpen(false);
      // Stay on the single-page list and refresh in place (no navigation).
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5">
          <PlusCircle className="h-3.5 w-3.5" />
          {t.newTopic}
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl" className="text-right">
        <DialogHeader>
          <DialogTitle>{t.newTopicTitle}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t.titleLabel}</label>
            <Input name="title" required maxLength={200} placeholder={t.titlePlaceholder} dir="auto" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">{t.bodyLabel}</label>
            <Textarea name="body" rows={4} maxLength={5000} placeholder={t.bodyPlaceholder} dir="auto" />
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              {t.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
              <PlusCircle className="h-3.5 w-3.5" />
              {t.post}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
