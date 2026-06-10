"use client";

import { BookOpen, CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { AnswerExplanation } from "@/components/AnswerExplanation";
import { QuestionImage } from "@/components/QuestionImage";
import { QuestionVideo } from "@/components/QuestionVideo";
import type { ForumQuestionView as Data } from "./actions";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

export function ForumQuestionView({ data }: { data: Data }) {
  return (
    <div className="space-y-3" dir={data.locale === "he" ? "rtl" : "ltr"}>
      <p className="text-base font-semibold whitespace-pre-wrap leading-snug [unicode-bidi:plaintext]" dir="auto">
        {data.stem}
      </p>

      <QuestionImage url={data.imageUrl} alt={data.imageAlt} />
      <QuestionVideo url={data.videoUrl} />

      <div className="space-y-1.5">
        {OPTION_KEYS.map((k, idx) => {
          const isCorrect = data.correctAnswer === k || data.acceptedAnswers.includes(k);
          const rowClass = isCorrect
            ? "flex items-start gap-2.5 rounded-lg border border-success/50 bg-success/10 p-2.5 text-sm"
            : "flex items-start gap-2.5 rounded-lg border border-border bg-background p-2.5 text-sm text-muted-foreground";
          const letterClass = isCorrect
            ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5 bg-success text-white"
            : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5 bg-muted text-muted-foreground";
          return (
            <div key={k} className={rowClass}>
              <span className={letterClass}>{data.letters[idx]}</span>
              <span dir="auto" className="flex-1 leading-snug [unicode-bidi:plaintext]">
                {data.optionTexts[idx]}
              </span>
              {isCorrect && <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />}
            </div>
          );
        })}
      </div>

      {data.answer ? (
        <>
          <Separator className="opacity-40" />
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <BookOpen className="h-3.5 w-3.5 shrink-0" />
            {data.detailedExplanationLabel}
          </div>
          <AnswerExplanation
            explanation={data.answer.explanation}
            evidenceCitations={data.answer.evidenceCitations}
            whyOthersWrong={data.answer.whyOthersWrong}
            correctAnswer={data.correctAnswer}
            acceptedAnswers={data.acceptedAnswers}
            userChoice={data.userChoice}
            options={[
              { key: "A", text: data.rawOptions[0] },
              { key: "B", text: data.rawOptions[1] },
              { key: "C", text: data.rawOptions[2] },
              { key: "D", text: data.rawOptions[3] },
            ]}
            insufficientEvidence={data.answer.insufficientEvidence}
            explanationImageUrl={data.answer.explanationImageUrl}
            explanationImageAlt={data.answer.explanationImageAlt}
            locale={data.locale}
            questionId={data.questionId}
            highlights={data.highlights}
            highlightT={data.highlightT}
          />
        </>
      ) : (
        <p className="text-sm text-muted-foreground italic">{data.noExplanationText}</p>
      )}
    </div>
  );
}
