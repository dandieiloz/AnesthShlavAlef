"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSingleQuestionAction, parseQuestionAction } from "./actions";
import { QUESTION_SOURCES } from "@/lib/hospitals";
import { SearchableSelect } from "@/components/ui/searchable-select";

type FieldKey = "stem" | "optionA" | "optionB" | "optionC" | "optionD";

const EMPTY_FIELDS: Record<FieldKey, string> = {
  stem: "",
  optionA: "",
  optionB: "",
  optionC: "",
  optionD: "",
};

type SavedBanner = { id: number };

export function SingleQuestionForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // question content fields
  const [fields, setFields] = useState<Record<FieldKey, string>>(EMPTY_FIELDS);
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // source fields (preserved on "add another")
  const [sourceInstitution, setSourceInstitution] = useState("");
  const [sourceYear, setSourceYear] = useState("");
  const [sourceSuffix, setSourceSuffix] = useState("");

  // raw-text parse
  const [rawText, setRawText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsing, startParsing] = useTransition();

  // submit state
  const [submitting, startSubmitting] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedBanner | null>(null);

  function update(k: FieldKey, v: string) {
    setFields((prev) => ({ ...prev, [k]: v }));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    setPreviewUrl(f ? URL.createObjectURL(f) : null);
  }

  function clearImage() {
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPreviewUrl(null);
  }

  function handleParse() {
    setParseError(null);
    if (rawText.trim().length < 20) { setParseError("טקסט קצר מדי"); return; }
    startParsing(async () => {
      const r = await parseQuestionAction(rawText);
      if (!r.ok) { setParseError(r.error); return; }
      setFields({
        stem: r.parsed.stem,
        optionA: r.parsed.optionA,
        optionB: r.parsed.optionB,
        optionC: r.parsed.optionC,
        optionD: r.parsed.optionD,
      });
    });
  }

  function clearQuestion() {
    setFields(EMPTY_FIELDS);
    setCorrectAnswer("");
    setImageAlt("");
    setVideoUrl("");
    setRawText("");
    setParseError(null);
    setSubmitError(null);
    setSaved(null);
    clearImage();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);
    setSaved(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    startSubmitting(async () => {
      const r = await createSingleQuestionAction(fd);
      if (!r.ok) { setSubmitError(r.error); return; }
      setSaved({ id: r.id });
    });
  }

  // Post-save banner
  if (saved) {
    return (
      <div className="rounded border bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 p-4 space-y-3">
        <p className="font-medium text-green-800 dark:text-green-300">✓ השאלה נשמרה!</p>
        <p className="text-sm text-green-700 dark:text-green-400">
          רוצה להוסיף שאלה נוספת לאותו מקור
          {sourceInstitution ? ` (${sourceInstitution}${sourceYear ? ` ${sourceYear}` : ""}${sourceSuffix ? ` ${sourceSuffix}` : ""})` : ""}?
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={clearQuestion}
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white"
          >
            כן, שאלה נוספת
          </button>
          <button
            type="button"
            onClick={() => router.push(`/admin/questions/${saved.id}`)}
            className="rounded border px-4 py-2 text-sm"
          >
            לא, עבור לשאלה שנשמרה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Raw-text paste & parse */}
      <div className="rounded border bg-muted/20 p-3 space-y-2">
        <label className="block text-xs font-medium">הדבק טקסט גולמי (אופציונלי)</label>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={5}
          placeholder={"לדוגמה: כיצד משפיעה היפותרמיה על CMRO₂?\nא. מעלה CMRO₂\nב. אינה משפיעה\nג. מורידה ב־1–2% לכל מעלה\nד. מורידה ב־6–7% לכל מעלה"}
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
              onClick={() => { setRawText(""); setFields(EMPTY_FIELDS); setParseError(null); }}
              className="text-xs text-muted-foreground hover:underline"
            >
              נקה
            </button>
          )}
        </div>
        {parseError && <p className="text-xs text-destructive">שגיאה: {parseError}</p>}
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
        {/* Stem */}
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

        {/* Options */}
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

        {/* Correct answer + source */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">תשובה נכונה</label>
            <select
              name="correctAnswer"
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
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
              value={sourceInstitution}
              onChange={setSourceInstitution}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">שנה</label>
            <input
              name="sourceYear"
              type="number"
              min={1990}
              max={2030}
              value={sourceYear}
              onChange={(e) => setSourceYear(e.target.value)}
              className="w-24 rounded border p-1 text-sm bg-background text-foreground"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">קבוצה (אופציונלי)</label>
            <input
              name="sourceSuffix"
              type="text"
              placeholder="לדוגמה: א, ב, מועד א"
              value={sourceSuffix}
              onChange={(e) => setSourceSuffix(e.target.value)}
              className="w-32 rounded border p-1 text-sm bg-background text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Image */}
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
              <button type="button" onClick={clearImage} className="text-xs text-destructive hover:underline">
                הסר תמונה
              </button>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">טקסט חלופי לתמונה (alt)</label>
            <input
              name="imageAlt"
              type="text"
              value={imageAlt}
              onChange={(e) => setImageAlt(e.target.value)}
              className="w-full rounded border p-1.5 text-sm bg-background text-foreground"
            />
          </div>
        </div>

        {/* Video */}
        <div className="rounded border bg-muted/20 p-3 space-y-2">
          <label className="block text-xs font-medium">קישור וידאו (אופציונלי)</label>
          <input
            name="videoUrl"
            type="url"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=... או https://vimeo.com/... או קובץ .mp4"
            className="w-full rounded border p-1.5 text-sm bg-background text-foreground placeholder:text-muted-foreground"
            dir="ltr"
          />
          <p className="text-[11px] text-muted-foreground">YouTube, Vimeo, או קובץ mp4/webm. הסרטון יתנגן אוטומטית (מושתק) בעת צפייה בשאלה.</p>
        </div>

        {submitError && (
          <p className="rounded border border-destructive bg-destructive/10 p-2 text-sm text-destructive">
            שגיאה: {submitError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {submitting ? "שומר..." : "שמור שאלה"}
        </button>
      </form>
    </div>
  );
}
