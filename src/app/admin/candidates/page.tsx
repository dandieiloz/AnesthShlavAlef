import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { AdminNav } from "../AdminNav";
import { CandidatesClient, type CandidateRow } from "./CandidatesClient";
import type { EvidenceCitationDisplay } from "@/components/AnswerExplanation";

export const dynamic = "force-dynamic";

export default async function CandidatesPage() {
  await requireAdmin();

  const candidates = await db.geminiAnswerCandidate.findMany({
    orderBy: { generatedAt: "desc" },
    include: {
      job: { select: { id: true, regenerationHint: true, finishedAt: true } },
      question: {
        select: {
          id: true,
          stem: true,
          source: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          chapter: { select: { number: true, title: true } },
          geminiAnswer: {
            select: {
              correctAnswer: true,
              explanation: true,
              whyOthersWrong: true,
              evidenceCitations: true,
              insufficientEvidence: true,
              confidence: true,
            },
          },
        },
      },
    },
  });

  const rows: CandidateRow[] = candidates.map((c) => ({
    questionId: c.questionId,
    generatedAt: c.generatedAt.toISOString(),
    hint: c.job?.regenerationHint ?? null,
    stem: c.question.stem,
    source: c.question.source,
    chapterNumber: c.question.chapter.number,
    chapterTitle: c.question.chapter.title,
    options: [
      { key: "A", text: c.question.optionA },
      { key: "B", text: c.question.optionB },
      { key: "C", text: c.question.optionC },
      { key: "D", text: c.question.optionD },
    ],
    candidate: {
      correctAnswer: c.correctAnswer,
      explanation: c.explanation,
      whyOthersWrong: c.whyOthersWrong,
      evidenceCitations: (c.evidenceCitations as EvidenceCitationDisplay[] | null) ?? [],
      insufficientEvidence: c.insufficientEvidence,
      confidence: c.confidence,
      model: c.model,
    },
    current: c.question.geminiAnswer
      ? {
          correctAnswer: c.question.geminiAnswer.correctAnswer,
          explanation: c.question.geminiAnswer.explanation,
          whyOthersWrong: c.question.geminiAnswer.whyOthersWrong,
          evidenceCitations:
            (c.question.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null) ?? [],
          insufficientEvidence: c.question.geminiAnswer.insufficientEvidence,
          confidence: c.question.geminiAnswer.confidence,
        }
      : null,
  }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <AdminNav />

      <div className="mt-6 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מועמדי חילול</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            השוו את החילול החדש לתשובה הקיימת ובחרו אם להחליף או להשליך.
          </p>
        </div>
        <Link href="/admin/queue" className="text-sm text-primary hover:underline">
          ← חזרה למרכז התור
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded border bg-card p-8 text-center text-muted-foreground">
          אין מועמדים ממתינים. משימות חילול חדשות יופיעו כאן לאחר השלמתן.
        </div>
      ) : (
        <CandidatesClient rows={rows} />
      )}
    </div>
  );
}
