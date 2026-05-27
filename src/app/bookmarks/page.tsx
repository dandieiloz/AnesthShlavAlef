import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toggleBookmarkAction } from "@/app/(user)/actions";
import { removeHighlightByIdAction } from "@/app/(user)/highlight-actions";
import { Bookmark, BookmarkX, BookOpen, Highlighter, StickyNote, Trash2 } from "lucide-react";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";

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

  const [bookmarks, highlights] = await Promise.all([
    db.bookmark.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      include: {
        question: {
          select: {
            id: true,
            stem: true,
            chapter: { select: { number: true, title: true } },
          },
        },
      },
    }),
    db.sentenceHighlight.findMany({
      where: { userId: me.id, locale: contentLocale },
      orderBy: [{ questionId: "desc" }, { section: "asc" }, { sentenceIndex: "asc" }],
      include: {
        question: {
          select: {
            id: true,
            stem: true,
            chapter: { select: { number: true, title: true } },
          },
        },
      },
    }),
  ]);

  const translated = await Promise.all(
    bookmarks.map((b) =>
      getTranslatedFields(
        "Question",
        String(b.question.id),
        { stem: b.question.stem, chapterTitle: b.question.chapter.title },
        contentLocale,
      ),
    ),
  );

  const highlightsByQ = new Map<number, typeof highlights>();
  for (const h of highlights) {
    const arr = highlightsByQ.get(h.questionId) ?? [];
    arr.push(h);
    highlightsByQ.set(h.questionId, arr);
  }
  const hQuestions = [...highlightsByQ.entries()].map(([qid, hs]) => ({
    qid,
    hs,
    question: hs[0].question,
  }));
  const hTranslated = await Promise.all(
    hQuestions.map(({ question }) =>
      getTranslatedFields(
        "Question",
        String(question.id),
        { stem: question.stem, chapterTitle: question.chapter.title },
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
          {t.subtitle(bookmarks.length)}
        </p>
      </div>

      <Tabs defaultValue="questions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="questions" className="gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            {t.tabQuestions}
            <span className="text-[10px] opacity-60">({bookmarks.length})</span>
          </TabsTrigger>
          <TabsTrigger value="highlights" className="gap-1.5">
            <Highlighter className="h-3.5 w-3.5" />
            {t.tabHighlights}
            <span className="text-[10px] opacity-60">({highlights.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="questions" className="mt-4">
          {bookmarks.length === 0 ? (
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
            <ul className="space-y-3">
              {bookmarks.map((b, i) => (
                <li key={b.id}>
                  <Card className="transition-all hover:shadow-sm">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {dict.common.chapter} {b.question.chapter.number}
                            </Badge>
                            <span className="text-xs text-muted-foreground line-clamp-1">
                              {translated[i].chapterTitle}
                            </span>
                          </div>
                          <p className="text-sm font-medium line-clamp-3">{translated[i].stem}</p>
                        </div>
                        <form action={toggleBookmarkAction}>
                          <input type="hidden" name="questionId" value={b.question.id} />
                          <button
                            type="submit"
                            title={t.removeBookmark}
                            className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-500 hover:text-destructive hover:bg-destructive/10 transition-colors"
                          >
                            <BookmarkX className="h-3.5 w-3.5" />
                            {t.remove}
                          </button>
                        </form>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {t.savedOn} {b.createdAt.toLocaleDateString(locale === "he" ? "he-IL" : "en-US")}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="highlights" className="mt-4">
          {hQuestions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
                <Highlighter className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">{t.highlightsEmpty}</p>
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-4">
              {hQuestions.map(({ qid, hs }, qi) => (
                <li key={qid}>
                  <Card>
                    <CardContent className="p-4 space-y-3" dir={contentLocale === "he" ? "rtl" : "ltr"}>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {dict.common.chapter} {hs[0].question.chapter.number}
                        </Badge>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {hTranslated[qi].chapterTitle}
                        </span>
                      </div>
                      <p dir="auto" className="text-sm font-medium line-clamp-2 [unicode-bidi:plaintext]">{hTranslated[qi].stem}</p>

                      <ul className="space-y-2">
                        {hs.map((h) => (
                          <li
                            key={h.id}
                            className={`rounded-md border border-border/60 px-3 py-2 ${COLOR_BG[h.colorId] ?? ""}`}
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
                                <p dir="auto" className="text-sm leading-relaxed [unicode-bidi:plaintext]">{h.sentenceText}</p>
                                {h.note && (
                                  <div className="flex items-start gap-1.5 rounded border border-amber-300/40 bg-background/50 px-2 py-1 text-xs">
                                    <StickyNote className="mt-0.5 h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <span dir="auto" className="text-foreground/85 whitespace-pre-wrap break-words [unicode-bidi:plaintext]">
                                      {h.note}
                                    </span>
                                  </div>
                                )}
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
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
