"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createReplyAction } from "./actions";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

type Strings = {
  replyLabel: string;
  replyPlaceholder: string;
  sendReply: string;
};

export function ReplyForm({ threadId, t, onSuccess }: { threadId: string; t: Strings; onSuccess?: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createReplyAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      formRef.current?.reset();
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-2">
      <input type="hidden" name="threadId" value={threadId} />
      <Textarea
        name="body"
        required
        rows={2}
        maxLength={2000}
        placeholder={t.replyPlaceholder}
        dir="auto"
        className="resize-none"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending} className="gap-1.5">
          <Send className="h-3.5 w-3.5" />
          {t.sendReply}
        </Button>
      </div>
    </form>
  );
}
