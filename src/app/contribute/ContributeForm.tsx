"use client";
import { useRef, useState, useTransition } from "react";
import { submitContributionAction } from "./actions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { GroupCombobox } from "@/components/GroupCombobox";
import { cn } from "@/lib/utils";

type Chapter = { number: number; title: string };
type Props = { isLoggedIn: boolean; hospitals: readonly string[]; chapters: readonly Chapter[] };

export function ContributeForm({ isLoggedIn, hospitals, chapters }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [mode, setMode] = useState<"paste" | "upload">("paste");
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    // Send only the content field for the active mode.
    if (!isLoggedIn || mode !== "upload") fd.delete("file");
    if (mode !== "paste") fd.delete("rawText");
    startSubmitting(async () => {
      const r = await submitContributionAction(fd);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDone(true);
      formRef.current?.reset();
      setFileName(null);
      setMode("paste");
    });
  }

  if (done) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950/30">
        <p className="text-lg font-semibold text-green-800 dark:text-green-300">תודה! השאלות נשלחו</p>
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
          הצוות יעבור על השאלות, יתקנן אותן ויוסיף אותן למאגר. תרומתך עוזרת לכל המתמחים.
        </p>
        <Button type="button" variant="outline" className="mt-4" onClick={() => setDone(false)}>
          שליחת אוסף נוסף
        </Button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Metadata */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="institute">
            מוסד <span className="text-destructive">*</span>
          </Label>
          <Input
            id="institute"
            name="institute"
            list="contribute-hospital-list"
            required
            maxLength={200}
            placeholder="בחרו או הקלידו שם מוסד"
          />
          <datalist id="contribute-hospital-list">
            {hospitals.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="year">שנה (לא חובה)</Label>
          <Input id="year" name="year" type="number" inputMode="numeric" min={1990} max={2100} placeholder="2026" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="suffix">קבוצה (לא חובה)</Label>
          <GroupCombobox id="suffix" name="suffix" placeholder="— ללא קבוצה —" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="chapterHint">פרק / נושא (לא חובה)</Label>
          <SearchableSelect
            id="chapterHint"
            name="chapterHint"
            options={chapters.map((c) => `${c.number}. ${c.title}`)}
            placeholder="בחרו פרק (לא חובה)"
            searchPlaceholder="חיפוש פרק..."
            clearable
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doctorName">שם הרופא/ה (לא חובה)</Label>
          <Input id="doctorName" name="doctorName" maxLength={200} placeholder="למשל: ד״ר ישראל ישראלי" />
        </div>
      </div>

      {/* Content mode switch (logged-in users can upload a file instead of pasting) */}
      {isLoggedIn && (
        <div className="inline-flex rounded-lg border bg-card p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === "paste" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            הדבקת טקסט
          </button>
          <button
            type="button"
            onClick={() => setMode("upload")}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              mode === "upload" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            העלאת קובץ
          </button>
        </div>
      )}

      {mode === "paste" ? (
        <div className="space-y-1.5">
          <Label htmlFor="rawText">השאלות והתשובות</Label>
          <Textarea
            id="rawText"
            name="rawText"
            dir="rtl"
            className="min-h-[18rem] font-mono text-sm"
            placeholder={
              "הדביקו כאן את השאלות יחד עם התשובות הנכונות (אם ידועות)...\n\nלדוגמה:\n1. מהי ההשפעה של ...?\nא. ...\nב. ...\nג. ...\nד. ...\nתשובה: ב"
            }
          />
          <p className="text-xs text-muted-foreground">
            אפשר להדביק מספר שאלות יחד. ציון התשובה הנכונה עוזר לנו, אך אינו חובה.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="file">קובץ PDF או Word</Label>
          <Input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="h-auto py-1.5 file:me-3 file:rounded file:border-0 file:bg-secondary file:px-3 file:py-1 file:text-sm file:font-medium"
          />
          {fileName && <p className="text-xs text-muted-foreground">נבחר: {fileName}</p>}
          <p className="text-xs text-muted-foreground">נחלץ את הטקסט מהקובץ אוטומטית. גודל מרבי 8MB.</p>
        </div>
      )}

      {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "שולח..." : "שליחה"}
        </Button>
        {!isLoggedIn && (
          <p className="text-xs text-muted-foreground">מחוברים? תוכלו גם להעלות קובץ PDF/Word במקום הדבקה.</p>
        )}
      </div>
    </form>
  );
}
