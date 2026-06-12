import "server-only";
import { db } from "@/lib/db";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere, hasUsableAnswerWhere, type PlanGatedUser } from "@/lib/plan";
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
  videoUrl: string | null;
  answer: {
    correctAnswer: Choice;
    /** Additional choices that an admin has marked as also accepted (excludes the primary correctAnswer). */
    acceptedAnswers: Choice[];
    explanation: string;
    whyOthersWrong: string;
    evidenceCitations: EvidenceCitationDisplay[] | null;
    insufficientEvidence: boolean;
    explanationImageUrl: string | null;
    explanationImageAlt: string | null;
  };
  bookmarked: boolean;
  latestReport: { status: "OPEN" | "RESOLVED" | "REJECTED"; adminResponse: string | null } | null;
  highlights: HighlightRecord[];
};

export type QuizBatch = {
  questions: QuestionPayload[];
  hasMore: boolean;
};

export type QuizSession = QuizBatch & {
  quiz: { id: number; name: string; chapterIds: number[]; questionIds: number[] };
  totals: { totalQ: number; answered: number; correct: number };
  /**
   * Previously-answered questions for this quiz, fully hydrated and ordered by
   * the time they were answered. Used to seed the client's "previous question"
   * back-stack so a resumed quiz can navigate to earlier questions.
   */
  answeredHistory: { question: QuestionPayload; chosen: Choice }[];
};

const DEFAULT_BATCH = 5;

/** Small, fast, deterministic PRNG (mulberry32) seeded from an integer. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Fisher-Yates shuffle. Given the same input and seed it always
 * produces the same order, so legacy chapter quizzes (which have no stored
 * order) can be delivered in a stable random order across batch refills.
 */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  const rand = mulberry32(seed);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Load a batch of unanswered questions, fully hydrated for the client
 * (translation, bookmark state, highlights). All per-question work runs in
 * parallel so one batch costs roughly one round of Promise.all, not N.
 *
 * Questions are delivered in the quiz's randomized order: fixed-set quizzes
 * carry their shuffled order in `questionIds` (set at creation), while legacy
 * chapter quizzes derive a deterministic per-quiz shuffle keyed by the quiz id.
 * The order is stable across refills, which the client relies on since it
 * paginates by passing back every served id in `excludeIds`.
 */
export async function loadQuizBatch(args: {
  user: PlanGatedUser;
  quiz: { id: number; chapterIds: number[]; questionIds: number[] };
  excludeIds: number[];
  contentLocale: "he" | "en";
  batchSize?: number;
  planGate?: Record<string, unknown>;
}): Promise<QuizBatch> {
  const batchSize = args.batchSize ?? DEFAULT_BATCH;
  const planGate = args.planGate ?? (await questionAccessWhere(args.user));
  const excludeSet = new Set(args.excludeIds);

  // Establish the stable, randomized delivery order for this quiz.
  let orderedIds: number[];
  if (args.quiz.questionIds.length > 0) {
    orderedIds = args.quiz.questionIds;
  } else {
    const poolRows = await db.question.findMany({
      where: {
        chapterIds: { hasSome: args.quiz.chapterIds },
        AND: [planGate, hasUsableAnswerWhere],
      },
      select: { id: true },
    });
    orderedIds = seededShuffle(poolRows.map((q) => q.id), args.quiz.id);
  }

  const remaining = orderedIds.filter((id) => !excludeSet.has(id));
  if (remaining.length === 0) return { questions: [], hasMore: false };

  // Drop ids that no longer pass the access / usable-answer gates while
  // preserving the randomized order. Ids-only so this pass stays cheap.
  const usableRows = await db.question.findMany({
    where: { id: { in: remaining }, AND: [planGate, hasUsableAnswerWhere] },
    select: { id: true },
  });
  const usableSet = new Set(usableRows.map((q) => q.id));
  const orderedUsable = remaining.filter((id) => usableSet.has(id));
  if (orderedUsable.length === 0) return { questions: [], hasMore: false };

  const hasMore = orderedUsable.length > batchSize;
  const windowIds = orderedUsable.slice(0, batchSize);

  const questions = await hydrateQuestionsByIds({
    user: args.user,
    ids: windowIds,
    contentLocale: args.contentLocale,
  });
  if (questions.length === 0) return { questions: [], hasMore: false };

  return { questions, hasMore };
}

/**
 * Hydrate a list of question ids into fully-rendered client payloads
 * (translation, bookmark state, highlights, latest report), preserving the
 * given id order. Questions without a usable answer (no GeminiAnswer and no
 * image+correctAnswer) are dropped. Shared by batch delivery and the
 * answered-history seeding used to make "previous question" work on resume.
 */
async function hydrateQuestionsByIds(args: {
  user: PlanGatedUser;
  ids: number[];
  contentLocale: "he" | "en";
}): Promise<QuestionPayload[]> {
  if (args.ids.length === 0) return [];

  const rows = await db.question.findMany({
    where: { id: { in: args.ids } },
    include: { chapter: true, geminiAnswer: true },
  });
  // Prisma `in` ignores array order, so re-sort rows to the requested order.
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const batch = args.ids
    .map((id) => rowById.get(id))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .filter((q) => q.geminiAnswer || (q.imageUrl && q.correctAnswer));
  if (batch.length === 0) return [];

  const ids = batch.map((q) => q.id);

  const [bookmarkRows, highlightRows, userReportRows] = await Promise.all([
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
      where: { userId: args.user.id, questionId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: { questionId: true, status: true, adminResponse: true, createdAt: true },
    }),
  ]);

  const bookmarkedSet = new Set(bookmarkRows.map((b) => b.questionId));
  const latestReportByQ = new Map<number, { status: "OPEN" | "RESOLVED" | "REJECTED"; adminResponse: string | null }>();
  for (const r of userReportRows) {
    if (!latestReportByQ.has(r.questionId)) {
      latestReportByQ.set(r.questionId, { status: r.status, adminResponse: r.adminResponse });
    }
  }
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
      const g = q.geminiAnswer;
      const [qFields, ansFields] = await Promise.all([
        getTranslatedFields(
          "Question",
          String(q.id),
          { stem: q.stem, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD },
          args.contentLocale,
        ),
        g
          ? getTranslatedFields(
              "GeminiAnswer",
              String(g.id),
              { explanation: g.explanation, whyOthersWrong: g.whyOthersWrong },
              args.contentLocale,
            )
          : Promise.resolve({ explanation: "", whyOthersWrong: "" }),
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
        videoUrl: q.videoUrl,
        answer: {
          correctAnswer: (g?.correctAnswer ?? q.correctAnswer!) as Choice,
          acceptedAnswers: (q.acceptedAnswers ?? []) as Choice[],
          explanation: g ? (ansFields.explanation || g.explanation) : "",
          whyOthersWrong: g ? (ansFields.whyOthersWrong || g.whyOthersWrong) : "",
          evidenceCitations: g
            ? ((g.evidenceCitations as EvidenceCitationDisplay[] | null) ?? null)
            : null,
          insufficientEvidence: g?.insufficientEvidence ?? false,
          explanationImageUrl: g?.explanationImageUrl ?? null,
          explanationImageAlt: g?.explanationImageAlt ?? null,
        },
        bookmarked: bookmarkedSet.has(q.id),
        latestReport: latestReportByQ.get(q.id) ?? null,
        highlights: highlightsByQ.get(q.id) ?? [],
      };
    }),
  );

  return questions;
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
      select: { questionId: true, chosen: true, isCorrect: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    useFixedSet
      ? db.question.count({
          where: { id: { in: quiz.questionIds }, AND: [planGate, hasUsableAnswerWhere] },
        })
      : db.question.count({
          where: { chapterIds: { hasSome: quiz.chapterIds }, AND: [planGate, hasUsableAnswerWhere] },
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

  // Seed the client's "previous question" back-stack with already-answered
  // questions so a resumed quiz can navigate backwards. Only worth hydrating
  // when there's an active question to return to (otherwise the page shows the
  // finished screen and never mounts the runner).
  let answeredHistory: { question: QuestionPayload; chosen: Choice }[] = [];
  if (batch.questions.length > 0 && attemptRows.length > 0) {
    // Latest attempt per question, keeping first-answered ordering.
    const latestByQ = new Map<number, { chosen: Choice; createdAt: Date }>();
    const firstSeenOrder: number[] = [];
    for (const a of attemptRows) {
      if (!latestByQ.has(a.questionId)) firstSeenOrder.push(a.questionId);
      latestByQ.set(a.questionId, { chosen: a.chosen as Choice, createdAt: a.createdAt });
    }
    const payloads = await hydrateQuestionsByIds({
      user: args.user,
      ids: firstSeenOrder,
      contentLocale: args.contentLocale,
    });
    const payloadById = new Map(payloads.map((p) => [p.id, p]));
    answeredHistory = firstSeenOrder
      .map((id) => {
        const q = payloadById.get(id);
        return q ? { question: q, chosen: latestByQ.get(id)!.chosen } : null;
      })
      .filter((x): x is { question: QuestionPayload; chosen: Choice } => x !== null);
  }

  return {
    quiz,
    totals: { totalQ, answered: answeredIds.length, correct },
    answeredHistory,
    ...batch,
  };
}
