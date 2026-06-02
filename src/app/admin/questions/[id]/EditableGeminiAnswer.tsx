"use client";

import { useState } from "react";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { saveGeminiAnswerFieldsAction } from "@/app/admin/actions";

type Choice = "A" | "B" | "C" | "D";

type Props = {
  questionId: number;
  explanation: string;
  whyOthersWrong: string;
  evidenceCitations: EvidenceCitationDisplay[];
  correctAnswer: Choice;
  options: { key: Choice; text: string }[];
  insufficientEvidence: boolean;
  defaultChapterNumber: number;
};

export function EditableGeminiAnswer({
  questionId,
  explanation,
  whyOthersWrong,
  evidenceCitations,
  correctAnswer,
  options,
  insufficientEvidence,
  defaultChapterNumber,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [exp, setExp] = useState(explanation);
  const [why, setWhy] = useState(whyOthersWrong);
  const [cites, setCites] = useState<EvidenceCitationDisplay[]>(evidenceCitations);

  function cancel() {
    setExp(explanation);
    setWhy(whyOthersWrong);
    setCites(evidenceCitations);
    setEditing(false);
  }

  function updateCite(i: number, patch: Partial<EvidenceCitationDisplay>) {
    setCites((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  }

  function removeCite(i: number) {
    setCites((prev) => prev.filter((_, idx) => idx !== i));
  }

  function addCite() {
    setCites((prev) => [
      ...prev,
      { chapterNumber: defaultChapterNumber, chapterTitle: "", sectionPath: null, quote: "", pageStart: null, pageEnd: null },
    ]);
  }

  if (!editing) {
    return (
      <div>
        <div className="mb-2 flex justify-end">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded border px-3 py-1 text-xs hover:bg-muted"
          >
            ערוך
          </button>
        </div>
        <AnswerExplanation
          explanation={explanation}
          evidenceCitations={evidenceCitations}
          whyOthersWrong={whyOthersWrong}
          correctAnswer={correctAnswer}
          options={options}
          insufficientEvidence={insufficientEvidence}
        />
      </div>
    );
  }

  return (
    <form action={saveGeminiAnswerFieldsAction} className="space-y-4 rounded border bg-card p-4">
      <input type="hidden" name="questionId" value={questionId} />
      <input type="hidden" name="evidenceCitationsJson" value={JSON.stringify(cites)} />

      <div>
        <label className="block text-xs font-semibold mb-1">הסבר</label>
        <textarea
          name="explanation"
          value={exp}
          onChange={(e) => setExp(e.target.value)}
          rows={10}
          className="w-full rounded border p-2 bg-background text-foreground font-mono text-xs"
          dir="rtl"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold mb-1">מדוע שאר האפשרויות שגויות</label>
        <p className="text-[11px] text-muted-foreground mb-1">
          שמור על הפורמט: <code>A. ...</code> שורה ריקה <code>B. ...</code> וכו׳
        </p>
        <textarea
          name="whyOthersWrong"
          value={why}
          onChange={(e) => setWhy(e.target.value)}
          rows={10}
          className="w-full rounded border p-2 bg-background text-foreground font-mono text-xs"
          dir="rtl"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className="block text-xs font-semibold">ראיות מספר הלימוד</label>
          <button
            type="button"
            onClick={addCite}
            className="rounded border px-2 py-0.5 text-xs hover:bg-muted"
          >
            + הוסף ציטוט
          </button>
        </div>
        <div className="space-y-3">
          {cites.length === 0 && (
            <p className="text-xs text-muted-foreground">אין ציטוטים. ניתן להוסיף ציטוט חדש.</p>
          )}
          {cites.map((c, i) => (
            <div key={i} className="rounded border p-2 space-y-2 bg-background/60">
              <div className="flex items-center gap-2 text-xs">
                <label className="flex items-center gap-1">
                  פרק:
                  <input
                    type="number"
                    min={1}
                    value={c.chapterNumber}
                    onChange={(e) =>
                      updateCite(i, { chapterNumber: Number(e.target.value) || 0 })
                    }
                    className="w-16 rounded border p-1 bg-background text-foreground"
                  />
                </label>
                <input
                  type="text"
                  placeholder="כותרת פרק"
                  value={c.chapterTitle}
                  onChange={(e) => updateCite(i, { chapterTitle: e.target.value })}
                  className="flex-1 rounded border p-1 bg-background text-foreground"
                />
                <input
                  type="text"
                  placeholder="נתיב סעיף (אופציונלי)"
                  value={c.sectionPath ?? ""}
                  onChange={(e) =>
                    updateCite(i, { sectionPath: e.target.value || null })
                  }
                  className="flex-1 rounded border p-1 bg-background text-foreground"
                />
                <label className="flex items-center gap-1">
                  עמ׳:
                  <input
                    type="number"
                    min={1}
                    placeholder="מ-"
                    value={c.pageStart ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      updateCite(i, { pageStart: v && Number.isFinite(v) && v > 0 ? v : null });
                    }}
                    className="w-16 rounded border p-1 bg-background text-foreground"
                  />
                </label>
                <label className="flex items-center gap-1">
                  עד:
                  <input
                    type="number"
                    min={1}
                    placeholder="עד-"
                    value={c.pageEnd ?? ""}
                    onChange={(e) => {
                      const v = e.target.value === "" ? null : Number(e.target.value);
                      updateCite(i, { pageEnd: v && Number.isFinite(v) && v > 0 ? v : null });
                    }}
                    className="w-16 rounded border p-1 bg-background text-foreground"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => removeCite(i)}
                  className="rounded border border-red-300 px-2 py-0.5 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  מחק
                </button>
              </div>
              <textarea
                value={c.quote}
                onChange={(e) => updateCite(i, { quote: e.target.value })}
                rows={3}
                className="w-full rounded border p-2 bg-background text-foreground text-xs"
                dir="rtl"
                placeholder="ציטוט מספר הלימוד"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button className="rounded bg-slate-900 px-4 py-2 text-sm text-white">שמור</button>
        <button
          type="button"
          onClick={cancel}
          className="rounded border px-4 py-2 text-sm hover:bg-muted"
        >
          בטל
        </button>
      </div>
    </form>
  );
}
