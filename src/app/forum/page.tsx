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
  title: "חדר מתמחים",
  description: "חדר המתמחים — שאלות, דיונים ושיתוף בין מתמחים",
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

  // Timestamp of the user's previous visit — used to flag threads with activity
  // they haven't seen yet. Read it before we update it below.
  const profile = await db.user.findUnique({
    where: { id: me.id },
    select: { forumLastVisitedAt: true },
  });
  const lastVisit = profile?.forumLastVisitedAt ?? null;

  const threads = await db.forumThread.findMany({
    orderBy: { lastReplyAt: "desc" },
    include: {
      question: { select: { id: true, stem: true } },
      author: { select: { name: true, image: true } },
      _count: { select: { replies: true } },
      replies: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { author: { select: { name: true, image: true } } },
      },
    },
    take: 100,
  });

  const items: ForumThreadListItem[] = threads.map((th) => {
    const isQuestion = th.questionId !== null;
    const lastReply = th.replies[0];
    // The author of the most recent activity (newest reply, or the thread itself).
    const lastActivityAuthorId = lastReply ? lastReply.authorId : th.authorId;
    const isNew =
      lastVisit !== null &&
      th.lastReplyAt > lastVisit &&
      lastActivityAuthorId !== me.id;
    return {
      id: th.id,
      isQuestion,
      isNew,
      title: isQuestion
        ? snippet(th.question?.stem ?? t.questionDiscussionTitle)
        : th.title ?? "",
      body: isQuestion ? null : th.body,
      authorName: th.author?.name ?? null,
      authorImage: th.author?.image ?? null,
      replyCount: th._count.replies,
      questionId: th.questionId,
      createdAtISO: th.createdAt.toISOString(),
      lastReplyAtISO: th.lastReplyAt.toISOString(),
      lastReply: lastReply
        ? {
            authorName: lastReply.author?.name ?? null,
            authorImage: lastReply.author?.image ?? null,
            body: snippet(lastReply.body),
            createdAtISO: lastReply.createdAt.toISOString(),
          }
        : null,
    };
  });

  // Mark this visit so the next load compares against now.
  await db.user.update({
    where: { id: me.id },
    data: { forumLastVisitedAt: new Date() },
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
        <ForumThreadList
          threads={items}
          meId={me.id}
          meName={me.name ?? null}
          meImage={me.image ?? null}
          meRole={me.role}
          locale={locale}
        />
      )}
    </div>
  );
}
