import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toggleBookmarkAction } from "@/app/(user)/actions";
import { removeHighlightByIdAction } from "@/app/(user)/highlight-actions";
import { AnswerExplanation, type EvidenceCitationDisplay } from "@/components/AnswerExplanation";
import { QuestionImage } from "@/components/QuestionImage";
import { QuestionVideo } from "@/components/QuestionVideo";
import { HighlightNoteEditor } from "@/components/HighlightNoteEditor";
import { HighlightSentence } from "@/components/HighlightSentence";
import { BookmarksSearch } from "@/components/BookmarksSearch";
import { Bookmark, BookmarkX, BookOpen, CheckCircle2, Highlighter, Trash2 } from "lucide-react";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";
import { questionAccessWhere } from "@/lib/plan";

const OPTION_KEYS = ["A", "B", "C", "D"] as const;

const COLOR_SWATCH: Record<number, string> = {
  1: "bg-yellow-300 dark:bg-yellow-400",
  2: "bg-green-300 dark:bg-green-400",
  3: "bg-pink-300 dark:bg-pink-400",
  4: "bg-blue-300 dark:bg-blue-400",
};
const COLOR_BG: Record<number, string> = {
  1: "bg-yellow-100/70 dark:bg-yellow-400/15",
  2: "bg-green-100/70 dark:bg-green-400/15",
  3: "bg-pink-100/70 dark:bg-pink-400/15",
  4: "bg-blue-100/70 dark:bg-blue-400/15",
};

function sectionLabel(
  section: string,
  t: { sectionExplanation: string; sectionWhyWrong: (letter: string) => string; sectionEvidence: string },
  letters: string[],
): string {
  if (section === "EXPLANATION") return t.sectionExplanation;
  const ww = section.match(/^WHY_WRONG_([ABCD])$/);
  if (ww) {
    const idx = ["A", "B", "C", "D"].indexOf(ww[1]);
    return t.sectionWhyWrong(letters[idx] ?? ww[1]);
  }
  if (/^EVIDENCE_\d+$/.test(section)) return t.sectionEvidence;
  return section;
}

export default async function BookmarksPage() {
  const me = await requireCompletedProfile();
  const [locale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const dict = getDictionary(locale);
  const t = dict.bookmarks;
  const letters = contentLocale === "he" ? ["א", "ב", "ג", "ד"] : ["A", "B", "C", "D"];

  const planGate = await questionAccessWhere(me);

  const [bookmarks, allHighlights] = await Promise.all([
    db.bookmark.findMany({
      where: { userId: me.id, question: planGate },
      orderBy: { createdAt: "desc" },
      include: {
        question: {
          select: {
            id: true,
            stem: true,
            optionA: true,
            optionB: true,
            optionC: true,
            optionD: true,
            correctAnswer: true,
            acceptedAnswers: true,
            imageUrl: true,
            imageAlt: true,
            videoUrl: true,
            chapter: { select: { number: true, title: true } },
            geminiAnswer: true,
          },
        },
      },
    }),
    db.sentenceHighlight.findMany({
      where: { userId: me.id, locale: contentLocale, question: planGate },
      orderBy: [{ questionId: "desc" }, { section: "asc" }, { sentenceIndex: "asc" }],
      select: {
        id: true,
        questionId: true,
        section: true,
        sentenceIndex: true,
        colorId: true,
        sentenceHash: true,
        sentenceText: true,
        note: true,
      },
    }),
  ]);

  const highlightsByQ = new Map<number, typeof allHighlights>();
  for (const h of allHighlights) {
    const arr = highlightsByQ.get(h.questionId) ?? [];
    arr.push(h);
    highlightsByQ.set(h.questionId, arr);
  }

  const bookmarkedIds = new Set(bookmarks.map((b) => b.question.id));
  const highlightedOnlyIds = [...highlightsByQ.keys()].filter((id) => !bookmarkedIds.has(id));

  const extraQuestions = highlightedOnlyIds.length
    ? await db.question.findMany({
        where: { AND: [{ id: { in: highlightedOnlyIds } }, planGate as Prisma.QuestionWhereInput] },
        select: {
          id: true,
          stem: true,
          optionA: true,
          optionB: true,
          optionC: true,
          optionD: true,
          correctAnswer: true,
          acceptedAnswers: true,
          imageUrl: true,
          imageAlt: true,
          videoUrl: true,
          chapter: { select: { number: true, title: true } },
          geminiAnswer: true,
        },
      })
    : [];

  type CardQuestion = (typeof bookmarks)[number]["question"];
  const entries: { question: CardQuestion; isBookmarked: boolean; savedOn: Date | null }[] = [
    ...bookmarks.map((b) => ({ question: b.question, isBookmarked: true, savedOn: b.createdAt })),
    ...extraQuestions.map((question) => ({ question, isBookmarked: false, savedOn: null })),
  ];

  const translated = await Promise.all(
    entries.map(({ question }) =>
      getTranslatedFields(
        "Question",
        String(question.id),
        {
          stem: question.stem,
          optionA: question.optionA,
          optionB: question.optionB,
          optionC: question.optionC,
          optionD: question.optionD,
          chapterTitle: question.chapter.title,
        },
        contentLocale,
      ),
    ),
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-amber-500" />
          {t.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.subtitle(entries.length)}
        </p>
      </div>

      <BookmarksSearch placeholder={t.searchPlaceholder} rtl={locale === "he"}>
        {entries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t.empty}</p>
              <Button asChild size="sm">
                <Link href="/study/new">{t.startQuiz}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3" data-search-group>
            {entries.map(({ question: q, isBookmarked, savedOn }, i) => {
              const qT = translated[i];
              const optionTexts = [qT.optionA, qT.optionB, qT.optionC, qT.optionD];
              const correctAnswer = q.geminiAnswer?.correctAnswer;
              const qHighlights = highlightsByQ.get(q.id) ?? [];
              const searchText = [
                qT.stem,
                qT.optionA,
                qT.optionB,
                qT.optionC,
                qT.optionD,
                qT.chapterTitle,
                `${dict.common.chapter} ${q.chapter.number}`,
                ...qHighlights.flatMap((h) => [h.sentenceText, h.note ?? ""]),
              ].join(" ");
              return (
              <li key={q.id} data-search-text={searchText}>
                <Card className="transition-all hover:shadow-sm">
                  <CardContent className="p-4 space-y-3" dir={contentLocale === "he" ? "rtl" : "ltr"}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary" className="text-xs shrink-0">
                            {dict.common.chapter} {q.chapter.number}
                          </Badge>
                          <span className="text-xs text-muted-foreground line-clamp-1" data-search-highlight>
                            {qT.chapterTitle}
                          </span>
                        </div>
                        <p dir="auto" className="text-sm font-medium leading-relaxed [unicode-bidi:plaintext]" data-search-highlight>
                          {qT.stem}
                        </p>
                      </div>
                      <form action={toggleBookmarkAction}>
                        <input type="hidden" name="questionId" value={q.id} />
                        <button
                          type="submit"
                          title={isBookmarked ? t.removeBookmark : t.addBookmark}
                          className={
                            isBookmarked
                              ? "shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-500 hover:text-destructive hover:bg-destructive/10 transition-colors"
                              : "shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                          }
                        >
                          {isBookmarked ? <BookmarkX className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                          {isBookmarked ? t.remove : t.addBookmark}
                        </button>
                      </form>
                    </div>
                    <QuestionImage url={q.imageUrl} alt={q.imageAlt} />
                    <QuestionVideo url={q.videoUrl} />

                    {/* Answer options */}
                    <div className="space-y-1.5">
                      {OPTION_KEYS.map((k, idx) => {
                        const isCorrect =
                          correctAnswer === k || q.acceptedAnswers.includes(k);
                        const rowClass = isCorrect
                          ? "flex items-start gap-2.5 rounded-lg border border-success/50 bg-success/10 p-2.5 text-sm"
                          : "flex items-start gap-2.5 rounded-lg border border-border bg-background p-2.5 text-sm text-muted-foreground";
                        const letterClass = isCorrect
                          ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5 bg-success text-white"
                          : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold mt-0.5 bg-muted text-muted-foreground";
                        return (
                          <div key={k} className={rowClass}>
                            <span className={letterClass}>{letters[idx]}</span>
                            <span dir="auto" className="flex-1 leading-snug [unicode-bidi:plaintext]" data-search-highlight>
                              {optionTexts[idx]}
                            </span>
                            {isCorrect && (
                              <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Full answer / explanation */}
                    {q.geminiAnswer && (
                      <>
                        <Separator className="opacity-40" />
                        <details className="group">
                          <summary className="flex cursor-pointer select-none list-none items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80">
                            <BookOpen className="h-3.5 w-3.5 shrink-0" />
                            {dict.review.detailedExplanation}
                          </summary>
                          <div className="mt-3">
                            <AnswerExplanation
                              explanation={q.geminiAnswer.explanation}
                              evidenceCitations={q.geminiAnswer.evidenceCitations as EvidenceCitationDisplay[] | null}
                              whyOthersWrong={q.geminiAnswer.whyOthersWrong}
                              correctAnswer={q.geminiAnswer.correctAnswer}
                              acceptedAnswers={q.acceptedAnswers}
                              options={[
                                { key: "A", text: q.optionA },
                                { key: "B", text: q.optionB },
                                { key: "C", text: q.optionC },
                                { key: "D", text: q.optionD },
                              ]}
                              insufficientEvidence={q.geminiAnswer.insufficientEvidence}
                              locale={contentLocale}
                              questionId={q.id}
                              highlights={qHighlights}
                              highlightT={dict.highlights}
                            />
                          </div>
                        </details>
                      </>
                    )}

                    {/* User's highlighted sentences for this question */}
                    {qHighlights.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <Highlighter className="h-3.5 w-3.5 shrink-0" />
                          {t.tabHighlights}
                        </div>
                        <ul className="space-y-1.5">
                          {qHighlights.map((h) => (
                            <li
                              key={h.id}
                              className={`rounded-md border border-border/60 px-2.5 py-1.5 ${COLOR_BG[h.colorId] ?? ""}`}
                              dir={contentLocale === "he" ? "rtl" : "ltr"}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0 space-y-1.5">
                                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                    <span
                                      className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${COLOR_SWATCH[h.colorId] ?? ""}`}
                                    />
                                    <span>{sectionLabel(h.section, t, letters)}</span>
                                  </div>
                                  <div data-search-highlight>
                                    <HighlightSentence text={h.sentenceText} />
                                  </div>
                                  <HighlightNoteEditor
                                    highlightId={h.id}
                                    note={h.note}
                                    locale={contentLocale}
                                    t={dict.highlights}
                                  />
                                </div>
                                <form action={removeHighlightByIdAction}>
                                  <input type="hidden" name="id" value={h.id} />
                                  <button
                                    type="submit"
                                    title={t.remove}
                                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </form>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {savedOn
                          ? `${t.savedOn} ${savedOn.toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}`
                          : ""}
                      </span>
                      <Button asChild size="sm" variant="secondary" className="gap-1.5">
                        <Link href={`/history/${q.id}`}>
                          <BookOpen className="h-3.5 w-3.5" />
                          {t.openQuestion}
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </li>
              );
            })}
            <li data-search-empty hidden>
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  {t.noMatches}
                </CardContent>
              </Card>
            </li>
          </ul>
        )}
      </BookmarksSearch>
    </div>
  );
}
