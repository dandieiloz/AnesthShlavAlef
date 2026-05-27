import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleBookmarkAction } from "@/app/(user)/actions";
import { Bookmark, BookmarkX, BookOpen } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getTranslatedFields } from "@/lib/translate";

export default async function BookmarksPage() {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.bookmarks;

  const bookmarks = await db.bookmark.findMany({
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
  });

  const translated = await Promise.all(
    bookmarks.map((b) =>
      getTranslatedFields(
        "Question",
        String(b.question.id),
        { stem: b.question.stem, chapterTitle: b.question.chapter.title },
        locale,
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

      {bookmarks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {t.empty}
            </p>
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
    </div>
  );
}
