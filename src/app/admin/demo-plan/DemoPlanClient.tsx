"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDemoSourceAllowedAction, setDemoNullSourceAllowedAction } from "./actions";

export type SourceRow = {
  source: string;
  allowed: boolean;
  questionCount: number;
};

export function DemoPlanClient({
  rows,
  nullSourceAllowed,
  nullSourceQuestionCount,
}: {
  rows: SourceRow[];
  nullSourceAllowed: boolean;
  nullSourceQuestionCount: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle(source: string, allowed: boolean) {
    startTransition(async () => {
      await setDemoSourceAllowedAction(source, allowed);
      router.refresh();
    });
  }

  function toggleNull(allowed: boolean) {
    startTransition(async () => {
      await setDemoNullSourceAllowedAction(allowed);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="rounded border bg-card p-3">
        <label className="flex items-center justify-between gap-3 cursor-pointer">
          <div>
            <div className="font-medium">שאלות ללא מקור</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              שאלות שאינן משויכות למבחן רשמי או לבית חולים
              {" · "}
              <span className="font-mono">{nullSourceQuestionCount}</span> שאלות
            </div>
          </div>
          <input
            type="checkbox"
            checked={nullSourceAllowed}
            disabled={pending}
            onChange={(e) => toggleNull(e.target.checked)}
            className="h-5 w-5 accent-emerald-600"
          />
        </label>
      </div>

      <ul className="divide-y rounded border bg-card">
        {rows.map((r) => (
          <li key={r.source} className="p-3">
            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <div className="min-w-0">
                <div className="font-medium truncate">{r.source}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-mono">{r.questionCount}</span> שאלות
                </div>
              </div>
              <input
                type="checkbox"
                checked={r.allowed}
                disabled={pending}
                onChange={(e) => toggle(r.source, e.target.checked)}
                className="h-5 w-5 accent-emerald-600"
              />
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
