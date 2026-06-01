import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { QueueClient, type QueueJobRow, type UnansweredQuestion } from "./QueueClient";
import type { JobStatus } from "@prisma/client";
import { AdminNav } from "../AdminNav";

const STATUS_LABEL: Record<JobStatus, string> = {
  PENDING: "ממתין",
  PROCESSING: "בעיבוד",
  DONE: "הושלם",
  FAILED: "נכשל",
  CANCELLED: "בוטל",
};

const STATUS_CLASS: Record<JobStatus, string> = {
  PENDING: "bg-sky-100 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300",
  PROCESSING: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300",
  DONE: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
  FAILED: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default async function QueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireAdmin();
  const { filter } = await searchParams;

  // Determine which statuses to show
  const activeStatuses: JobStatus[] =
    filter === "done"
      ? ["DONE"]
      : filter === "cancelled"
      ? ["CANCELLED"]
      : filter === "all"
      ? ["PENDING", "PROCESSING", "FAILED", "DONE", "CANCELLED"]
      : ["PENDING", "PROCESSING", "FAILED"];

  // Status counts
  const rawCounts = await db.answerGenerationJob.groupBy({
    by: ["status"],
    _count: { id: true },
  });
  const counts: Record<JobStatus, number> = {
    PENDING: 0,
    PROCESSING: 0,
    DONE: 0,
    FAILED: 0,
    CANCELLED: 0,
  };
  for (const row of rawCounts) counts[row.status] = row._count.id;

  // Active job list with question stem preview
  const jobs = await db.answerGenerationJob.findMany({
    where: { status: { in: activeStatuses } },
    orderBy: [{ queuedAt: "asc" }],
    include: {
      question: {
        select: {
          id: true,
          stem: true,
          source: true,
          geminiAnswer: { select: { id: true } },
          chapter: { select: { number: true, title: true } },
        },
      },
    },
  });

  // Sort by logical status priority (not alphabetical): PROCESSING first, then
  // PENDING, then FAILED, then DONE, then CANCELLED. Within a status, oldest first.
  const STATUS_PRIORITY: Record<JobStatus, number> = {
    PROCESSING: 0,
    PENDING: 1,
    FAILED: 2,
    DONE: 3,
    CANCELLED: 4,
  };
  jobs.sort((a, b) => {
    const d = STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status];
    if (d !== 0) return d;
    return a.queuedAt.getTime() - b.queuedAt.getTime();
  });

  const rows: QueueJobRow[] = jobs.map((j) => ({
    id: j.id,
    questionId: j.question.id,
    stem: j.question.stem,
    source: j.question.source ?? null,
    chapterNumber: j.question.chapter.number,
    chapterTitle: j.question.chapter.title,
    hasAnswer: j.question.geminiAnswer !== null,
    status: j.status,
    kind: j.kind,
    attempts: j.attempts,
    lastError: j.lastError ?? null,
    queuedAt: j.queuedAt.toISOString(),
    startedAt: j.startedAt?.toISOString() ?? null,
    finishedAt: j.finishedAt?.toISOString() ?? null,
  }));

  // On the active tab only: find questions without an answer and without any open job
  const unansweredQuestions: UnansweredQuestion[] =
    !filter || filter === "active"
      ? (await db.question.findMany({
          where: {
            geminiAnswer: null,
            generationJobs: {
              none: { status: { in: ["PENDING", "PROCESSING", "FAILED"] } },
            },
          },
          select: {
            id: true,
            stem: true,
            source: true,
            chapter: { select: { number: true, title: true } },
          },
          orderBy: { id: "asc" },
        })).map((q) => ({
          id: q.id,
          stem: q.stem,
          source: q.source ?? null,
          chapterNumber: q.chapter.number,
          chapterTitle: q.chapter.title,
        }))
      : [];

  return (
    <div className="space-y-6">
      <AdminNav />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">מרכז התור — חילול הסברים</h1>
        <Link
          href="/admin/new-question"
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          + הוסף שאלות חדשות
        </Link>
      </div>

      {/* Status counters */}
      <div className="flex flex-wrap gap-2">
        {(["PENDING", "PROCESSING", "FAILED", "DONE", "CANCELLED"] as JobStatus[]).map((s) => (
          <span key={s} className={`rounded-full px-3 py-1 text-xs font-medium ${STATUS_CLASS[s]}`}>
            {STATUS_LABEL[s]}: {counts[s]}
          </span>
        ))}
        {(!filter || filter === "active") && unansweredQuestions.length > 0 && (
          <span className="rounded-full px-3 py-1 text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300">
            ללא הסבר (ללא משימה): {unansweredQuestions.length}
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 text-sm border-b pb-2">
        {[
          { label: "פעיל (ממתין + נכשל)", value: undefined },
          { label: "הושלם", value: "done" },
          { label: "בוטל", value: "cancelled" },
          { label: "הכל", value: "all" },
        ].map(({ label, value }) => {
          const href = value ? `/admin/queue?filter=${value}` : "/admin/queue";
          const isActive = filter === value;
          return (
            <Link
              key={label}
              href={href}
              className={`px-3 py-1 rounded ${isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <QueueClient rows={rows} unansweredQuestions={unansweredQuestions} />
    </div>
  );
}
