import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/format-time";
import { AdminNav } from "../../../AdminNav";
import { AttemptsFilters, type ChapterOption } from "./AttemptsFilters";

const LIMIT = 500;
const STEM_PREVIEW_CHARS = 110;
const DATE_FORMATTER = new Intl.DateTimeFormat("he-IL", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatRelative(date: Date): string {
  return formatRelativeTime(date, Date.now(), "he");
}

type AttemptRow = {
  id: number;
  createdAt: Date;
  chosen: "A" | "B" | "C" | "D";
  isCorrect: boolean;
  question: {
    id: number;
    stem: string;
    correctAnswer: "A" | "B" | "C" | "D" | null;
    chapter: { id: number; number: number; title: string };
  };
};

type ChapterGroup = {
  chapterNumber: number;
  chapterTitle: string;
  rows: AttemptRow[];
};

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export default async function AdminUserAttemptsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string; chapter?: string; correct?: string }>;
}) {
  await requireAdmin();
  const { id: userId } = await params;
  const sp = await searchParams;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      fullName: true,
      email: true,
      image: true,
      role: true,
      plan: true,
    },
  });

  if (!user) {
    notFound();
  }

  const chapterNumber = sp.chapter && /^\d+$/.test(sp.chapter) ? Number(sp.chapter) : null;
  const correctFilter: boolean | null =
    sp.correct === "yes" ? true : sp.correct === "no" ? false : null;
  const stemQuery = sp.q?.trim() ?? "";

  const questionFilter: Prisma.QuestionWhereInput = {};
  if (chapterNumber !== null) {
    questionFilter.chapter = { number: chapterNumber };
  }
  if (stemQuery) {
    questionFilter.stem = { contains: stemQuery, mode: "insensitive" };
  }

  const where: Prisma.AttemptWhereInput = { userId };
  if (correctFilter !== null) where.isCorrect = correctFilter;
  if (Object.keys(questionFilter).length > 0) where.question = questionFilter;

  const [attempts, filteredTotal, totalAttempts, correctCount, uniqueQuestionsGroup, lastAttempt, chapters] =
    await Promise.all([
      db.attempt.findMany({
        where,
        include: {
          question: {
            select: {
              id: true,
              stem: true,
              correctAnswer: true,
              chapter: { select: { id: true, number: true, title: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: LIMIT,
      }),
      db.attempt.count({ where }),
      db.attempt.count({ where: { userId } }),
      db.attempt.count({ where: { userId, isCorrect: true } }),
      db.attempt.groupBy({ by: ["questionId"], where: { userId } }),
      db.attempt.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      db.chapter.findMany({
        select: { id: true, number: true, title: true },
        orderBy: { number: "asc" },
      }),
    ]);

  const uniqueQuestionsCount = uniqueQuestionsGroup.length;
  const percentCorrect =
    totalAttempts === 0 ? null : Math.round((correctCount / totalAttempts) * 100);

  // Group by chapter, preserving newest-first ordering within each group.
  const groupsMap = new Map<number, ChapterGroup>();
  for (const a of attempts as AttemptRow[]) {
    const key = a.question.chapter.number;
    let g = groupsMap.get(key);
    if (!g) {
      g = {
        chapterNumber: key,
        chapterTitle: a.question.chapter.title,
        rows: [],
      };
      groupsMap.set(key, g);
    }
    g.rows.push(a);
  }
  const groups = Array.from(groupsMap.values()).sort(
    (a, b) => a.chapterNumber - b.chapterNumber,
  );

  const displayName = user.fullName ?? user.name ?? user.email;
  const chapterOptions: ChapterOption[] = chapters;

  return (
    <div className="space-y-4">
      <AdminNav />

      <div className="flex flex-col gap-1">
        <Link
          href="/admin/users"
          className="text-xs text-muted-foreground hover:text-foreground w-fit"
        >
          ← חזרה לרשימת המשתמשים
        </Link>
        <h1 className="font-display text-2xl font-bold flex items-center gap-3">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="h-8 w-8 rounded-full object-cover" />
          ) : null}
          היסטוריית שאלות – {displayName}
        </h1>
        <div className="text-xs text-muted-foreground">{user.email}</div>
      </div>

      {/* Global stats (unaffected by filters) */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono">{totalAttempts}</div>
          <div className="text-xs text-muted-foreground mt-1">סה״כ ניסיונות</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono">{uniqueQuestionsCount}</div>
          <div className="text-xs text-muted-foreground mt-1">שאלות ייחודיות</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {correctCount}
          </div>
          <div className="text-xs text-muted-foreground mt-1">תשובות נכונות</div>
        </div>
        <div className="rounded border bg-card p-3">
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {percentCorrect === null ? "—" : `${percentCorrect}%`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">אחוז הצלחה</div>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        פעיל לאחרונה:{" "}
        {lastAttempt ? (
          <span className="text-foreground" title={DATE_FORMATTER.format(lastAttempt.createdAt)}>
            {formatRelative(lastAttempt.createdAt)}
          </span>
        ) : (
          <span className="italic">מעולם לא ענה</span>
        )}
      </div>

      <Suspense>
        <AttemptsFilters userId={user.id} chapters={chapterOptions} />
      </Suspense>

      <div className="text-sm text-muted-foreground">
        {filteredTotal === 0
          ? "אין ניסיונות התואמים את הסינון."
          : filteredTotal > LIMIT
            ? `מציג ${LIMIT} מתוך ${filteredTotal} ניסיונות`
            : `${filteredTotal} ניסיונות`}
      </div>

      {groups.length === 0 ? null : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.chapterNumber} className="rounded border bg-card">
              <header className="flex items-center justify-between border-b px-4 py-2">
                <h2 className="font-medium">
                  פרק {group.chapterNumber}: {group.chapterTitle}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {group.rows.length} ניסיונות
                </span>
              </header>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="p-2 text-start text-muted-foreground whitespace-nowrap">
                      תאריך
                    </th>
                    <th className="p-2 text-start text-muted-foreground">שאלה</th>
                    <th className="p-2 text-center text-muted-foreground whitespace-nowrap">
                      נבחר
                    </th>
                    <th className="p-2 text-center text-muted-foreground whitespace-nowrap">
                      נכון
                    </th>
                    <th className="p-2 text-center text-muted-foreground whitespace-nowrap">
                      תוצאה
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((a) => (
                    <tr key={a.id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="p-2 text-muted-foreground whitespace-nowrap">
                        {DATE_FORMATTER.format(a.createdAt)}
                      </td>
                      <td className="p-2">
                        <Link
                          href={`/history/${a.question.id}`}
                          className="hover:underline"
                        >
                          {truncate(a.question.stem, STEM_PREVIEW_CHARS)}
                        </Link>
                      </td>
                      <td className="p-2 text-center font-mono">{a.chosen}</td>
                      <td className="p-2 text-center font-mono text-muted-foreground">
                        {a.question.correctAnswer ?? "—"}
                      </td>
                      <td className="p-2 text-center">
                        {a.isCorrect ? (
                          <span className="text-xs rounded px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300">
                            ✓ נכון
                          </span>
                        ) : (
                          <span className="text-xs rounded px-2 py-0.5 bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300">
                            ✗ שגוי
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
