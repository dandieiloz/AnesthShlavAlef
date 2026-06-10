import Link from "next/link";
import { db } from "@/lib/db";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessagesSquare, MessageSquare } from "lucide-react";

function snippet(s: string, max = 80): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

export async function ForumPreview({ locale }: { locale: Locale }) {
  const t = getDictionary(locale).study;

  const replies = await db.forumReply.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
    include: {
      author: { select: { name: true } },
      thread: {
        select: {
          id: true,
          title: true,
          questionId: true,
          question: { select: { stem: true } },
        },
      },
    },
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <MessagesSquare className="h-4 w-4 text-primary" />
            {t.forumPreviewTitle}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t.forumPreviewHint}</p>
        </div>
        <Button asChild size="sm" variant="secondary">
          <Link href="/forum">{t.forumPreviewCta}</Link>
        </Button>
      </div>

      {replies.length === 0 ? (
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-sm text-muted-foreground">
            {t.forumPreviewEmpty}
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {replies.map((r) => {
            const threadTitle =
              r.thread.questionId !== null
                ? snippet(r.thread.question?.stem ?? "")
                : snippet(r.thread.title ?? "");
            return (
              <li key={r.id}>
                <Link href={`/forum/${r.thread.id}`} className="block">
                  <Card className="transition-colors hover:bg-muted/40">
                    <CardContent className="p-3 flex items-start gap-3">
                      <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-muted-foreground truncate" dir="auto">
                          {threadTitle}
                        </p>
                        <p className="text-sm leading-snug line-clamp-2" dir="auto">
                          {r.body}
                        </p>
                        {r.author?.name && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{r.author.name}</p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
