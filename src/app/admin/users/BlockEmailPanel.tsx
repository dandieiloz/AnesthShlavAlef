"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { blockEmailAction, unblockEmailAction } from "./actions";

export type BlockedEntry = {
  email: string;
  reason: string | null;
  createdAt: string;
};

const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeZone: "Asia/Jerusalem",
});

export function BlockEmailPanel({ blocked }: { blocked: BlockedEntry[] }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function submitBlock(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    startTransition(async () => {
      try {
        await blockEmailAction(value, reason.trim() || undefined);
        setEmail("");
        setReason("");
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "חסימת האימייל נכשלה");
      }
      router.refresh();
    });
  }

  function unblock(value: string) {
    startTransition(async () => {
      try {
        await unblockEmailAction(value);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "ביטול החסימה נכשל");
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded border bg-card p-4 space-y-3">
      <div>
        <h2 className="font-semibold">חסימת אימייל</h2>
        <p className="text-xs text-muted-foreground mt-1">
          חסימה מונעת התחברות והרשמה. ניתן לחסום גם אימייל שעדיין אינו רשום במערכת.
        </p>
      </div>

      <form onSubmit={submitBlock} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">אימייל</label>
          <input
            type="email"
            dir="ltr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            className="rounded border bg-background px-2 py-1 text-sm w-64"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground">סיבה (אופציונלי)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="rounded border bg-background px-2 py-1 text-sm w-64"
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded border border-red-400 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-3 py-1 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {pending ? "..." : "חסום"}
        </button>
      </form>

      {blocked.length > 0 ? (
        <div className="space-y-1">
          <div className="text-xs text-muted-foreground">{blocked.length} אימיילים חסומים</div>
          <ul className="divide-y rounded border">
            {blocked.map((b) => (
              <li key={b.email} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-mono" dir="ltr">{b.email}</span>
                  {b.reason ? (
                    <span className="text-muted-foreground"> — {b.reason}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground/70">
                    {" "}({DATE_FORMATTER.format(new Date(b.createdAt))})
                  </span>
                </div>
                <button
                  onClick={() => unblock(b.email)}
                  disabled={pending}
                  className="shrink-0 rounded border px-2 py-1 text-xs hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  בטל חסימה
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground italic">אין אימיילים חסומים</div>
      )}
    </div>
  );
}
