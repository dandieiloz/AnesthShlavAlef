import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { usefulnessTone, TONE_ROW_CLASS, TONE_BADGE_CLASS, TONE_LABEL } from "@/lib/usefulness";
import { AlertTriangle } from "lucide-react";
import { AdminNav } from "./AdminNav";

export default async function AdminHome() {
  await requireAdmin();
  const chapters = await db.chapter.findMany({
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      title: true,
      ingestedAt: true,
      learningUsefulnessIndex: true,
      _count: { select: { chunks: true } }
    },
  });

  // Count questions per chapter using chapterIds[] array (same logic as the detail page),
  // because a question can belong to multiple chapters via chapterIds[].
  // _count.questions only counts via the chapterId FK (primary chapter), which under-counts.
  const rawCounts = await db.$queryRaw<{ chapter_id: number; cnt: bigint }[]>`
    SELECT unnest("chapterIds") AS chapter_id, COUNT(*) AS cnt
    FROM "Question"
    GROUP BY chapter_id
  `;
  const questionCountByChapterId = new Map<number, number>(
    rawCounts.map((r) => [r.chapter_id, Number(r.cnt)])
  );

  return (
    <div className="space-y-6">
      <AdminNav />
      <h1 className="font-display text-2xl font-bold">ניהול פרקים</h1>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12 text-center">פרק</TableHead>
            <TableHead>כותרת</TableHead>
            <TableHead className="w-16 text-center">קטעים</TableHead>
            <TableHead className="w-20 text-center"># שאלות</TableHead>
            <TableHead className="w-32 text-center">מועילות</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {chapters.map((c) => {
            const tone = usefulnessTone(c.learningUsefulnessIndex);
            return (
              <TableRow key={c.id} className={TONE_ROW_CLASS[tone]}>
                <TableCell className="text-center font-mono text-sm font-medium">{c.number}</TableCell>
                <TableCell className="font-medium">
                  <Link href={`/admin/chapters/${c.number}/questions`} className="text-primary hover:underline">
                    {c.title}
                  </Link>
                  {!c.ingestedAt && (
                    <span title="לא נקלט">
                      <AlertTriangle className="inline h-3.5 w-3.5 ms-1.5 text-warning" />
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">{c._count.chunks}</TableCell>
                <TableCell className="text-center text-muted-foreground">{questionCountByChapterId.get(c.id) ?? 0}</TableCell>
                <TableCell className="text-center">
                  <Badge className={`text-xs ${TONE_BADGE_CLASS[tone]}`}>
                    {TONE_LABEL[tone]}
                    {c.learningUsefulnessIndex !== null && (
                      <span className="opacity-60 ms-1">({c.learningUsefulnessIndex})</span>
                    )}
                  </Badge>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
