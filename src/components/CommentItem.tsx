"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { editCommentAction, deleteCommentAction } from "@/app/(user)/actions";

type CommentUser = {
  name: string | null;
  image: string | null;
  hospitalName: string | null;
};

export type CommentData = {
  id: number;
  body: string;
  userId: string;
  createdAt: Date;
  editedAt: Date | null;
  user: CommentUser;
};

type Props = {
  comment: CommentData;
  meId: string;
  meRole: "USER" | "ADMIN";
};

export function CommentItem({ comment: c, meId, meRole }: Props) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const canEdit = c.userId === meId || meRole === "ADMIN";
  const canDelete = meRole === "ADMIN";

  function handleEditSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await editCommentAction(fd);
      setEditing(false);
    });
  }

  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-2">
          {c.user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.user.image} alt="" className="h-5 w-5 rounded-full object-cover" />
          ) : null}
          <div className="flex flex-col">
            <span className="text-xs font-medium">{c.user.name}</span>
            {c.user.hospitalName && (
              <span className="text-[10px] text-muted-foreground leading-tight">{c.user.hospitalName}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground ms-auto">
            {c.createdAt.toLocaleDateString("he-IL")}
            {c.editedAt && <span className="ms-1 italic">(עודכן)</span>}
          </span>
          {canEdit && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="ערוך הערה"
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
                title="מחק הערה"
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
                שמור
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
                ביטול
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
