"use client";
import { useRef, useState, useTransition } from "react";
import { saveWizardQuestionAction, parseQuestionAction } from "./actions";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";

type FieldKey = "stem" | "optionA" | "optionB" | "optionC" | "optionD";

const EMPTY: Record<FieldKey, string> = {
  stem: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
};

export function SingleQuestionForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<FieldKey, string>>(EMPTY);
  const [rawText, setRawText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, startParsing] = useTransition();

  function update(k: FieldKey, v: string) {
    setFields((prev) => ({ ...prev, [k]: v }));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) {
      setPreviewUrl(null);
      return;
    }
    setPreviewUrl(URL.createObjectURL(f));
  }

  function clearImage() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPreviewUrl(null);
  }

  function handleParse() {
    setParseError(null);
    if (rawText.trim().length < 20) {
      setParseError("טקסט קצר מדי");
      return;
    }
    startParsing(async () => {
      const r = await parseQuestionAction(rawText);
      if (!r.ok) {
        setParseError(r.error);
        return;
      }
      setFields({
        stem: r.parsed.stem,
        optionA: r.parsed.optionA,
        optionB: r.parsed.optionB,
        optionC: r.parsed.optionC,
        optionD: r.parsed.optionD,
      });
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded border bg-muted/20 p-3 space-y-2">
        <label className="block text-xs font-medium">הדבק טקסט גולמי (אופציונלי)</label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={5}
          placeholder="לדוגמה: כיצד משפיעה היפותרמיה על CMRO₂?&#10;א. מעלה CMRO₂&#10;ב. אינה משפיעה&#10;ג. מורידה ב־1–2% לכל מעלה&#10;ד. מורידה ב־6–7% לכל מעלה"
          className="w-full rounded border p-2 font-mono text-sm bg-background text-foreground placeholder:text-muted-foreground"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleParse}
            disabled={parsing || rawText.trim().length < 20}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
          >
            {parsing ? "מנתח..." : "נתח עם Gemini ומלא טופס"}
          </button>
          {(rawText || fields.stem) && (
            <button
              type="button"
              onClick={() => {
                setRawText("");
                setFields(EMPTY);
                setParseError(null);
              }}
              className="text-xs text-muted-foreground hover:underline"
            >
              נקה
            </button>
          )}
        </div>
        {parseError && (
          <p className="text-xs text-destructive">שגיאה: {parseError}</p>
        )}
      </div>

      <form action={saveWizardQuestionAction} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">גוף השאלה</label>
          <textarea
            name="stem"
            rows={3}
            required
            minLength={3}
            value={fields.stem}
            onChange={(e) => update("stem", e.target.value)}
            className="w-full rounded border p-2 text-sm bg-background text-foreground"
          />
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {(["A", "B", "C", "D"] as const).map((letter, i) => (
            <div key={letter}>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                תשובה {["א", "ב", "ג", "ד"][i]}
              </label>
              <input
                name={`option${letter}`}
                required
                value={fields[`option${letter}` as FieldKey]}
                onChange={(e) => update(`option${letter}` as FieldKey, e.target.value)}
                className="w-full rounded border p-1.5 text-sm bg-background text-foreground"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">תשובה נכונה</label>
            <select
              name="correctAnswer"
              defaultValue=""
              className="rounded border p-1 text-sm bg-background text-foreground"
            >
              <option value="">— לא הוגדר —</option>
              <option value="A">א</option>
              <option value="B">ב</option>
              <option value="C">ג</option>
              <option value="D">ד</option>
            </select>
          </div>
          <div className="min-w-[14rem]">
            <label className="block text-xs font-medium text-muted-foreground mb-1">מוסד (אופציונלי)</label>
            <SearchableSelect
              name="sourceInstitution"
              options={QUESTION_SOURCES}
              clearable
              clearLabel="— ללא מוסד —"
              placeholder="— ללא מוסד —"
              searchPlaceholder="חיפוש מוסד..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">שנה</label>
            <input
              name="sourceYear"
              type="number"
              min={1990}
              max={2030}
              className="w-24 rounded border p-1 text-sm bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">קבוצה (אופציונלי)</label>
            <input
              name="sourceSuffix"
              type="text"
              placeholder="לדוגמה: א, ב, מועד א"
              className="w-32 rounded border p-1 text-sm bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <div className="rounded border bg-muted/20 p-3 space-y-2">
          <label className="block text-xs font-medium">תמונה (אופציונלי)</label>
          <input
            ref={fileInputRef}
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFileChange}
            className="block text-sm"
          />
          <p className="text-[11px] text-muted-foreground">PNG / JPEG / WebP / GIF · עד 5MB</p>
          {previewUrl && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="תצוגה מקדימה" className="max-h-48 rounded border bg-background" />
              <button
                type="button"
                onClick={clearImage}
                className="text-xs text-destructive hover:underline"
              >
                הסר תמונה
              </button>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">טקסט חלופי לתמונה (alt)</label>
            <input
              name="imageAlt"
              type="text"
              className="w-full rounded border p-1.5 text-sm bg-background text-foreground"
            />
          </div>
        </div>

        <div className="rounded border bg-muted/20 p-3 space-y-2">
          <label className="block text-xs font-medium">קישור וידאו (אופציונלי)</label>
          <input
            name="videoUrl"
            type="url"
            placeholder="https://www.youtube.com/watch?v=... או https://vimeo.com/... או קובץ .mp4"
            className="w-full rounded border p-1.5 text-sm bg-background text-foreground placeholder:text-muted-foreground"
            dir="ltr"
          />
          <p className="text-[11px] text-muted-foreground">YouTube, Vimeo, או קובץ mp4/webm. הסרטון יתנגן אוטומטית (מושתק) בעת צפייה בשאלה.</p>
        </div>

        <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-sm text-white">
          שמור שאלה
        </button>
      </form>
    </div>
  );
}
