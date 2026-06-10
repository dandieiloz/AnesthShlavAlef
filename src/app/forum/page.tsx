import type { Metadata } from "next";
import { requireCompletedProfile } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { MessagesSquare } from "lucide-react";
import { NewThreadForm } from "./NewThreadForm";
import { ForumThreadList, type ForumThreadListItem } from "./ForumThreadList";

export const metadata: Metadata = {
  title: "פורום",
  description: "פורום הקהילה — שאלות, דיונים ושיתוף בין מתמחים",
};

function snippet(s: string, max = 120): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max) + "…" : clean;
}

export default async function ForumPage() {
  const me = await requireCompletedProfile();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.forum;

  const threads = await db.forumThread.findMany({
    orderBy: { lastReplyAt: "desc" },
    include: {
      question: { select: { id: true, stem: true } },
      author: { select: { name: true } },
      _count: { select: { replies: true } },
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { name: true } } },
      },
    },
    take: 100,
  });

  const items: ForumThreadListItem[] = threads.map((th) => {
    const isQuestion = th.questionId !== null;
    const lastReply = th.replies[0];
    return {
      id: th.id,
      isQuestion,
      title: isQuestion
        ? snippet(th.question?.stem ?? t.questionDiscussionTitle)
        : th.title ?? "",
      body: isQuestion ? null : th.body,
      authorName: th.author?.name ?? null,
      replyCount: th._count.replies,
      questionId: th.questionId,
      lastReply: lastReply
        ? { authorName: lastReply.author?.name ?? null, body: snippet(lastReply.body) }
        : null,
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in text-right" dir="rtl">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <MessagesSquare className="h-6 w-6 text-primary" />
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
        <NewThreadForm
          t={{
            newTopic: t.newTopic,
            newTopicTitle: t.newTopicTitle,
            titleLabel: t.titleLabel,
            titlePlaceholder: t.titlePlaceholder,
            bodyLabel: t.bodyLabel,
            bodyPlaceholder: t.bodyPlaceholder,
            post: t.post,
            cancel: dict.common.cancel,
          }}
        />
      </header>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {t.empty}
          </CardContent>
        </Card>
      ) : (
        <ForumThreadList threads={items} meId={me.id} meRole={me.role} locale={locale} />
      )}
    </div>
  );
}
