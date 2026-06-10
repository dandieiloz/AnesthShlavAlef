"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar } from "@/components/ui/avatar";
import { RelativeTime } from "@/lib/relative-time";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { editCommentAction, deleteCommentAction } from "@/app/(user)/actions";
import { getDictionary } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";

type CommentUser = {
  name: string | null;
  image: string | null;
  hospitalName: string | null;
};

export type CommentData = {
  id: string;
  body: string;
  authorId: string;
  createdAt: Date;
  editedAt: Date | null;
  author: CommentUser;
};

type Props = {
  comment: CommentData;
  meId: string;
  meRole: "USER" | "ADMIN";
  locale: Locale;
};

export function CommentItem({ comment: c, meId, meRole, locale }: Props) {
  const t = getDictionary(locale).quiz;
  const justNow = getDictionary(locale).forum.justNow;
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canEdit = c.authorId === meId || meRole === "ADMIN";
  const canDelete = c.authorId === meId || meRole === "ADMIN";

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await editCommentAction(fd);
      setEditing(false);
    });
  }

  return (
    <Card className="border-border/60 bg-card/80">
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-2">
          <Avatar name={c.author.name} image={c.author.image} size="sm" />
          <div className="flex flex-col">
            <span className="text-xs font-medium">{c.author.name}</span>
            {c.author.hospitalName && (
              <span className="text-[10px] text-muted-foreground leading-tight">{c.author.hospitalName}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground ms-auto">
            <RelativeTime date={c.createdAt} locale={locale} justNow={justNow} />
            {c.editedAt && <span className="ms-1 italic">({t.commentEdited})</span>}
          </span>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={t.editComment}
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
          {canDelete && !editing && (
            <form action={deleteCommentAction}>
              <input type="hidden" name="commentId" value={c.id} />
              <button
                type="submit"
                className="text-muted-foreground hover:text-destructive transition-colors"
                title={t.deleteComment}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </form>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleEditSubmit} className="space-y-2">
            <input type="hidden" name="commentId" value={c.id} />
            <Textarea
              name="body"
              required
              defaultValue={c.body}
              rows={3}
              className="text-sm"
              disabled={isPending}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" className="gap-1" disabled={isPending}>
                <Check className="h-3 w-3" />
                {t.commentSave}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
                disabled={isPending}
                className="gap-1"
              >
                <X className="h-3 w-3" />
                {t.commentCancel}
              </Button>
            </div>
          </form>
        ) : (
          <p className="text-sm whitespace-pre-wrap leading-snug">{c.body}</p>
        )}
      </CardContent>
    </Card>
  );
}
