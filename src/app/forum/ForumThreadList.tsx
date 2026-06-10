"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, FileQuestion, MessageSquare } from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { CommentItem, type CommentData } from "@/components/CommentItem";
import { ReplyForm } from "./ReplyForm";
import { ForumQuestionView } from "./ForumQuestionView";
import { loadThreadRepliesAction, loadThreadQuestionAction, type ForumQuestionView as ForumQuestionData } from "./actions";

export type ForumThreadListItem = {
  id: string;
  isQuestion: boolean;
  title: string;
  body: string | null;
  authorName: string | null;
  replyCount: number;
  questionId: number | null;
  lastReply: { authorName: string | null; body: string } | null;
};

export function ForumThreadList({
  threads,
  meId,
  meRole,
  locale,
}: {
  threads: ForumThreadListItem[];
  meId: string;
  meRole: "USER" | "ADMIN";
  locale: Locale;
}) {
  return (
    <ul className="space-y-2">
      {threads.map((th, i) => (
        <li key={th.id}>
          <ThreadRow th={th} index={i} meId={meId} meRole={meRole} locale={locale} />
        </li>
      ))}
    </ul>
  );
}

function ThreadRow({
  th,
  index,
  meId,
  meRole,
  locale,
}: {
  th: ForumThreadListItem;
  index: number;
  meId: string;
  meRole: "USER" | "ADMIN";
  locale: Locale;
}) {
  const t = getDictionary(locale).forum;
  const [open, setOpen] = useState(false);
  const [replies, setReplies] = useState<CommentData[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [questionOpen, setQuestionOpen] = useState(false);
  const [question, setQuestion] = useState<ForumQuestionData | null>(null);
  const [qLoading, startQLoading] = useTransition();

  function loadReplies() {
    startLoading(async () => {
      const rows = await loadThreadRepliesAction(th.id);
      setReplies(rows);
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && replies === null) loadReplies();
  }

  function toggleQuestion() {
    const next = !questionOpen;
    setQuestionOpen(next);
    if (next && question === null && th.questionId !== null) {
      const qid = th.questionId;
      startQLoading(async () => {
        const data = await loadThreadQuestionAction(qid);
        setQuestion(data);
      });
    }
  }

  const isEven = index % 2 === 0;
  const cardTint = isEven
    ? "border-e-4 border-e-primary/60 bg-primary/[0.04]"
    : "border-e-4 border-e-accent bg-accent/40";
  const hoverTint = isEven ? "hover:bg-primary/[0.08]" : "hover:bg-accent/60";

  return (
    <Card className={`overflow-hidden ${cardTint}`} dir="rtl">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className={`block w-full text-right transition-colors ${hoverTint}`}
      >
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {th.isQuestion && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <FileQuestion className="h-3 w-3" />
                  {t.questionBadge}
                </Badge>
              )}
              <span className="font-medium text-sm">
                {th.title}
              </span>
            </div>
            {!th.isQuestion && th.body && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                {th.body}
              </p>
            )}
            {th.lastReply && !open && (
              <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 flex items-start gap-1.5">
                <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
                <span className="min-w-0">
                  {th.lastReply.authorName ? (
                    <span className="font-medium text-foreground/80">{th.lastReply.authorName}: </span>
                  ) : null}
                  {th.lastReply.body}
                </span>
              </p>
            )}
            <p className="mt-1 text-[11px] text-muted-foreground">
              {th.authorName ? `${th.authorName} · ` : ""}
              {t.replyCount(th.replyCount)}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CardContent>
      </button>

      {open && (
        <div className="border-t bg-muted/20 p-4 space-y-3">
          {th.isQuestion && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={toggleQuestion}
                aria-expanded={questionOpen}
                className="gap-1.5"
              >
                <FileQuestion className="h-3.5 w-3.5" />
                {t.viewQuestion}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${questionOpen ? "rotate-180" : ""}`} />
              </Button>
              {questionOpen && (
                <div className="rounded-lg border bg-background p-3">
                  {qLoading && question === null ? (
                    <p className="text-xs text-muted-foreground">…</p>
                  ) : question ? (
                    <ForumQuestionView data={question} />
                  ) : (
                    <p className="text-xs text-muted-foreground">{t.noReplies}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {loading && replies === null ? (
            <p className="text-xs text-muted-foreground">…</p>
          ) : replies && replies.length > 0 ? (
            <ul className="space-y-2">
              {replies.map((r) => (
                <li key={r.id}>
                  <CommentItem comment={r} meId={meId} meRole={meRole} locale={locale} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">{t.noReplies}</p>
          )}

          <ReplyForm
            threadId={th.id}
            onSuccess={loadReplies}
            t={{ replyLabel: t.replyLabel, replyPlaceholder: t.replyPlaceholder, sendReply: t.sendReply }}
          />
        </div>
      )}
    </Card>
  );
}
