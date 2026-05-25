import { db } from "@/lib/db";
import { requireCompletedProfile } from "@/lib/auth";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleBookmarkAction } from "@/app/(user)/actions";
import { Bookmark, BookmarkX, BookOpen } from "lucide-react";

export default async function BookmarksPage() {
  const me = await requireCompletedProfile();

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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold flex items-center gap-2">
          <Bookmark className="h-6 w-6 text-amber-500" />
          שאלות שסומנו
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {bookmarks.length === 0
            ? "טרם סימנת שאלות."
            : `${bookmarks.length} ${bookmarks.length === 1 ? "שאלה" : "שאלות"} שמורות`}
        </p>
      </div>

      {bookmarks.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              בזמן מבחן, לחץ על כפתור הסימנייה בכל שאלה שתרצה לסמן.
            </p>
            <Button asChild size="sm">
              <Link href="/study/new">התחל מבחן</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {bookmarks.map((b) => (
            <li key={b.id}>
              <Card className="transition-all hover:shadow-sm">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs shrink-0">
                          פרק {b.question.chapter.number}
                        </Badge>
                        <span className="text-xs text-muted-foreground line-clamp-1">
                          {b.question.chapter.title}
                        </span>
                      </div>
                      <p className="text-sm font-medium line-clamp-3">{b.question.stem}</p>
                    </div>
                    <form action={toggleBookmarkAction}>
                      <input type="hidden" name="questionId" value={b.question.id} />
                      <button
                        type="submit"
                        title="הסר סימנייה"
                        className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1 text-xs text-amber-500 hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <BookmarkX className="h-3.5 w-3.5" />
                        הסר
                      </button>
                    </form>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      נשמר {b.createdAt.toLocaleDateString("he-IL")}
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
