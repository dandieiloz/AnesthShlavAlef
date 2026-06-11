"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RelativeTime } from "@/lib/relative-time";
import {
  ChevronDown,
  FileQuestion,
  MessageSquare,
  MessagesSquare,
  Search,
  Sparkles,
} from "lucide-react";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { CommentItem, type CommentData } from "@/components/CommentItem";
import { ReplyForm } from "./ReplyForm";
import { ForumQuestionView } from "./ForumQuestionView";
import { DeleteThreadButton } from "./DeleteThreadButton";
import {
  loadThreadRepliesAction,
  loadThreadQuestionAction,
  type ForumQuestionView as ForumQuestionData,
} from "./actions";

export type ForumThreadListItem = {
  id: string;
  isQuestion: boolean;
  isNew: boolean;
  title: string;
  body: string | null;
  authorId: string | null;
  authorName: string | null;
  authorImage: string | null;
  replyCount: number;
  questionId: number | null;
  createdAtISO: string;
  lastReplyAtISO: string;
  lastReply: {
    authorName: string | null;
    authorImage: string | null;
    body: string;
    createdAtISO: string;
  } | null;
};

type Filter = "all" | "questions" | "discussions";

export function ForumThreadList({
  threads,
  meId,
  meName,
  meImage,
  meRole,
  locale,
}: {
  threads: ForumThreadListItem[];
  meId: string;
  meName: string | null;
  meImage: string | null;
  meRole: "USER" | "ADMIN";
  locale: Locale;
}) {
  const t = getDictionary(locale).forum;
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((th) => {
      if (filter === "questions" && !th.isQuestion) return false;
      if (filter === "discussions" && th.isQuestion) return false;
      if (!q) return true;
      return (
        th.title.toLowerCase().includes(q) ||
        (th.body ?? "").toLowerCase().includes(q) ||
        (th.authorName ?? "").toLowerCase().includes(q)
      );
    });
  }, [threads, filter, query]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList>
            <TabsTrigger value="all">{t.filterAll}</TabsTrigger>
            <TabsTrigger value="questions" className="gap-1.5">
              <FileQuestion className="h-3.5 w-3.5" />
              {t.filterQuestions}
            </TabsTrigger>
            <TabsTrigger value="discussions" className="gap-1.5">
              <MessagesSquare className="h-3.5 w-3.5" />
              {t.filterDiscussions}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="pe-9"
            dir="auto"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 py-12 text-center text-sm text-muted-foreground">
          {t.noResults}
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((th) => (
            <li key={th.id}>
              <ThreadRow
                th={th}
                meId={meId}
                meName={meName}
                meImage={meImage}
                meRole={meRole}
                locale={locale}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ThreadRow({
  th,
  meId,
  meName,
  meImage,
  meRole,
  locale,
}: {
  th: ForumThreadListItem;
  meId: string;
  meName: string | null;
  meImage: string | null;
  meRole: "USER" | "ADMIN";
  locale: Locale;
}) {
  const t = getDictionary(locale).forum;
  const rowRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const deepLinked = searchParams.get("thread") === th.id;

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

  // Auto-expand when deep-linked from the study preview (/forum?thread=ID).
  useEffect(() => {
    if (deepLinked && !open) {
      setOpen(true);
      if (replies === null) loadReplies();
      rowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinked]);

  const accentBar = th.isNew
    ? "before:bg-accent"
    : th.isQuestion
      ? "before:bg-primary"
      : "before:bg-secondary-foreground/30";
  const showNew = th.isNew && !open;
  const baseBg = showNew ? "bg-accent/[0.05]" : "bg-card";
  const stateRing = open
    ? "ring-1 ring-primary/30 shadow-md"
    : showNew
      ? "ring-1 ring-accent/40 hover:-translate-y-0.5 hover:shadow-md"
      : "hover:-translate-y-0.5 hover:shadow-md";

  return (
    <div
      ref={rowRef}
      dir="rtl"
      className={`group relative overflow-hidden rounded-xl border shadow-sm transition-all ${baseBg}
        before:absolute before:inset-y-0 before:end-0 before:w-1 ${accentBar}
        ${stateRing}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="block w-full text-right transition-colors hover:bg-muted/30"
      >
        <div className="flex items-start gap-3 p-4">
          <Avatar name={th.authorName} image={th.authorImage} size="md" className="mt-0.5" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              {showNew && (
                <Badge className="gap-1 bg-accent text-accent-foreground text-[10px] hover:bg-accent">
                  <Sparkles className="h-3 w-3" />
                  {t.newBadge}
                </Badge>
              )}
              {th.isQuestion && (
                <Badge variant="secondary" className="gap-1 text-[10px]">
                  <FileQuestion className="h-3 w-3" />
                  {t.questionBadge}
                </Badge>
              )}
              <span className="font-semibold text-sm leading-snug">{th.title}</span>
            </div>

            {!th.isQuestion && th.body && (
              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{th.body}</p>
            )}

            {th.lastReply && !open && (
              <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
                <Avatar
                  name={th.lastReply.authorName}
                  image={th.lastReply.authorImage}
                  size="sm"
                  className="mt-0.5"
                />
                <p className="min-w-0 text-xs text-muted-foreground line-clamp-2">
                  {th.lastReply.authorName ? (
                    <span className="font-medium text-foreground/80">
                      {th.lastReply.authorName}:{" "}
                    </span>
                  ) : null}
                  {th.lastReply.body}
                </p>
              </div>
            )}

            <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
              {th.authorName && <span className="font-medium">{th.authorName}</span>}
              <span aria-hidden>·</span>
              <RelativeTime date={th.lastReplyAtISO} locale={locale} justNow={t.justNow} />
              <span className="ms-auto inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-medium text-foreground/70">
                <MessageSquare className="h-3 w-3" />
                {th.replyCount}
              </span>
            </div>
          </div>

          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="animate-fade-in border-t bg-muted/20 p-4 space-y-3">
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
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform ${questionOpen ? "rotate-180" : ""}`}
                />
              </Button>
              {questionOpen && (
                <div className="rounded-lg border bg-background p-3">
                  {qLoading && question === null ? (
                    <QuestionSkeleton />
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
            <RepliesSkeleton />
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

          {(meRole === "ADMIN" || (!th.isQuestion && th.authorId === meId)) && (
            <div className="flex justify-end">
              <DeleteThreadButton
                threadId={th.id}
                label={t.deleteTopic}
                confirmText={t.deleteConfirm}
              />
            </div>
          )}

          <div className="flex items-start gap-2 pt-1">
            <Avatar name={meName} image={meImage} size="sm" className="mt-1.5" />
            <div className="min-w-0 flex-1">
              <ReplyForm
                threadId={th.id}
                onSuccess={loadReplies}
                t={{
                  replyLabel: t.replyLabel,
                  replyPlaceholder: t.replyPlaceholder,
                  sendReply: t.sendReply,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RepliesSkeleton() {
  return (
    <ul className="space-y-2">
      {[0, 1].map((i) => (
        <li key={i} className="flex items-start gap-2 rounded-lg border bg-card p-3">
          <Skeleton className="h-7 w-7 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function QuestionSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
