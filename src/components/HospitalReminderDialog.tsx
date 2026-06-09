"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { setHospitalAction } from "@/lib/hospital-reminder-actions";

const STORAGE_KEY = "hospital-reminder-last-shown-v1";
const HOUR_MS = 60 * 60 * 1000;

export function HospitalReminderDialog({
  hospitals,
}: {
  hospitals: ReadonlyArray<string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();

  const maybeOpen = useCallback(() => {
    let last = 0;
    try {
      last = Number(localStorage.getItem(STORAGE_KEY)) || 0;
    } catch {
      last = 0;
    }
    if (Date.now() - last >= HOUR_MS) {
      try {
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      setOpen(true);
    }
  }, []);

  // Use a ref so the interval always sees the latest open state.
  const openRef = useRef(open);
  openRef.current = open;

  useEffect(() => {
    maybeOpen();
    const interval = setInterval(() => {
      if (!openRef.current) maybeOpen();
    }, 60_000);
    return () => clearInterval(interval);
  }, [maybeOpen]);

  function handleSave() {
    if (!value) return;
    startTransition(async () => {
      try {
        await setHospitalAction(value);
        setOpen(false);
        router.refresh();
      } catch {
        /* keep dialog open on failure */
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="inline-flex w-fit items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary-foreground shadow-sm">
            <Building2 className="h-3 w-3" />
            פרופיל
          </span>
          <DialogTitle className="text-xl">השלמת פרטי בית החולים</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground/80">
            עדיין לא בחרתם בית חולים. בחירת בית החולים שלכם עוזרת לנו להציג סטטיסטיקה
            ולשפר את החוויה עבורכם.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="hospitalReminderSelect">בית חולים</Label>
          <SearchableSelect
            id="hospitalReminderSelect"
            options={hospitals}
            value={value}
            onChange={setValue}
            placeholder="בחרו בית חולים"
            searchPlaceholder="חיפוש בית חולים..."
          />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            אזכיר לי מאוחר יותר
          </Button>
          <Button onClick={handleSave} disabled={!value || isPending}>
            שמירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
