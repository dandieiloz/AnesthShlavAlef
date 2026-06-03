import "server-only";
import { db } from "@/lib/db";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere, type PlanGatedUser } from "@/lib/plan";
import type { EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import type { HighlightRecord } from "@/components/HighlightableMarkdown";

export type Choice = "A" | "B" | "C" | "D";

export type QuestionPayload = {
  id: number;
  source: string | null;
  chapter: { number: number; title: string };
  stem: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  imageUrl: string | null;
  imageAlt: string | null;
  answer: {
    correctAnswer: Choice;
    explanation: string;
    whyOthersWrong: string;
    evidenceCitations: EvidenceCitationDisplay[] | null;
    insufficientEvidence: boolean;
  };
  bookmarked: boolean;
  hasPendingReport: boolean;
  highlights: HighlightRecord[];
};

export type QuizBatch = {
  questions: QuestionPayload[];
  hasMore: boolean;
};

export type QuizSession = QuizBatch & {
  quiz: { id: number; name: string; chapterIds: number[]; questionIds: number[] };
  totals: { totalQ: number; answered: number; correct: number };
};

const DEFAULT_BATCH = 5;

/**
 * Build the Prisma `where` for the quiz's unanswered question pool.
 */
function buildQuestionFilter(
  quiz: { chapterIds: number[]; questionIds: number[] },
  excludeIds: number[],
  planGate: Record<string, unknown>,
) {
  const useFixedSet = quiz.questionIds.length > 0;
  if (useFixedSet) {
    return {
      id: { in: quiz.questionIds, notIn: excludeIds },
      geminiAnswer: { isNot: null },
      AND: [planGate],
    };
  }
  return {
    chapterIds: { hasSome: quiz.chapterIds },
    id: { notIn: excludeIds },
    geminiAnswer: { isNot: null },
    AND: [planGate],
  };
}

/**
 * Load a batch of unanswered questions, fully hydrated for the client
 * (translation, bookmark state, highlights). All per-question work runs in
 * parallel so one batch costs roughly one round of Promise.all, not N.
 */
export async function loadQuizBatch(args: {
  user: PlanGatedUser;
  quiz: { chapterIds: number[]; questionIds: number[] };
  excludeIds: number[];
  contentLocale: "he" | "en";
  batchSize?: number;
  planGate?: Record<string, unknown>;
}): Promise<QuizBatch> {
  const batchSize = args.batchSize ?? DEFAULT_BATCH;
  const planGate = args.planGate ?? (await questionAccessWhere(args.user));
  const filter = buildQuestionFilter(args.quiz, args.excludeIds, planGate);

  const rows = await db.question.findMany({
    where: filter,
    orderBy: { id: "asc" },
    take: batchSize + 1,
    include: { chapter: true, geminiAnswer: true },
  });

  const hasMore = rows.length > batchSize;
  const batch = rows.slice(0, batchSize).filter((q) => q.geminiAnswer);
  if (batch.length === 0) return { questions: [], hasMore: false };

  const ids = batch.map((q) => q.id);

  const [bookmarkRows, highlightRows, pendingReportRows] = await Promise.all([
    db.bookmark.findMany({
      where: { userId: args.user.id, questionId: { in: ids } },
      select: { questionId: true },
    }),
    db.sentenceHighlight.findMany({
      where: { userId: args.user.id, questionId: { in: ids }, locale: args.contentLocale },
      select: {
        id: true,
        questionId: true,
        section: true,
        sentenceIndex: true,
        colorId: true,
        sentenceHash: true,
        note: true,
      },
    }),
    db.answerReport.findMany({
      where: { questionId: { in: ids }, status: "OPEN" },
      select: { questionId: true },
      distinct: ["questionId"],
    }),
  ]);

  const bookmarkedSet = new Set(bookmarkRows.map((b) => b.questionId));
  const pendingReportSet = new Set(pendingReportRows.map((r) => r.questionId));
  const highlightsByQ = new Map<number, HighlightRecord[]>();
  for (const h of highlightRows) {
    const list = highlightsByQ.get(h.questionId) ?? [];
    list.push({
      id: h.id,
      section: h.section,
      sentenceIndex: h.sentenceIndex,
      colorId: h.colorId,
      sentenceHash: h.sentenceHash,
      note: h.note,
    });
    highlightsByQ.set(h.questionId, list);
  }

  const questions: QuestionPayload[] = await Promise.all(
    batch.map(async (q) => {
      const g = q.geminiAnswer!;
      const [qFields, ansFields] = await Promise.all([
        getTranslatedFields(
          "Question",
          String(q.id),
          { stem: q.stem, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD },
          args.contentLocale,
        ),
        getTranslatedFields(
          "GeminiAnswer",
          String(g.id),
          { explanation: g.explanation, whyOthersWrong: g.whyOthersWrong },
          args.contentLocale,
        ),
      ]);
      return {
        id: q.id,
        source: q.source,
        chapter: { number: q.chapter.number, title: q.chapter.title },
        stem: qFields.stem,
        optionA: qFields.optionA,
        optionB: qFields.optionB,
        optionC: qFields.optionC,
        optionD: qFields.optionD,
        imageUrl: q.imageUrl,
        imageAlt: q.imageAlt,
        answer: {
          correctAnswer: g.correctAnswer as Choice,
          explanation: ansFields.explanation || g.explanation,
          whyOthersWrong: ansFields.whyOthersWrong || g.whyOthersWrong,
          evidenceCitations: (g.evidenceCitations as EvidenceCitationDisplay[] | null) ?? null,
          insufficientEvidence: g.insufficientEvidence,
        },
        bookmarked: bookmarkedSet.has(q.id),
        hasPendingReport: pendingReportSet.has(q.id),
        highlights: highlightsByQ.get(q.id) ?? [],
      };
    }),
  );

  return { questions, hasMore };
}

/**
 * Full session load for the quiz page's initial render. One Promise.all gathers
 * everything the client needs (quiz meta, totals, first batch).
 */
export async function loadQuizSession(args: {
  user: PlanGatedUser;
  quizId: number;
  contentLocale: "he" | "en";
  batchSize?: number;
}): Promise<QuizSession | null> {
  const quiz = await db.quiz.findFirst({
    where: { id: args.quizId, userId: args.user.id },
    select: { id: true, name: true, chapterIds: true, questionIds: true },
  });
  if (!quiz) return null;

  const planGate = await questionAccessWhere(args.user);
  const useFixedSet = quiz.questionIds.length > 0;

  const [attemptRows, totalQ] = await Promise.all([
    db.attempt.findMany({
      where: { userId: args.user.id, quizId: quiz.id },
      select: { questionId: true, isCorrect: true },
    }),
    useFixedSet
      ? Promise.resolve(quiz.questionIds.length)
      : db.question.count({
          where: { chapterIds: { hasSome: quiz.chapterIds }, geminiAnswer: { isNot: null }, AND: [planGate] },
        }),
  ]);

  const answeredIds = attemptRows.map((a) => a.questionId);
  const correct = attemptRows.reduce((n, a) => n + (a.isCorrect ? 1 : 0), 0);

  const batch = await loadQuizBatch({
    user: args.user,
    quiz,
    excludeIds: answeredIds,
    contentLocale: args.contentLocale,
    batchSize: args.batchSize,
    planGate,
  });

  return {
    quiz,
    totals: { totalQ, answered: answeredIds.length, correct },
    ...batch,
  };
}
