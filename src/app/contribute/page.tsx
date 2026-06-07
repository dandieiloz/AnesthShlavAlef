import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { HOSPITALS } from "@/lib/hospitals";
import { ContributeForm } from "./ContributeForm";

export const metadata: Metadata = {
  title: "תרומת שאלות",
  description: "שליחת שאלות ותשובות למאגר השאלות",
};

export default async function ContributePage() {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);

  const chapters = await db.chapter.findMany({
    orderBy: { number: "asc" },
    select: { number: true, title: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">תרומת שאלות למאגר</h1>
        <p className="text-sm text-muted-foreground">
          נתקלתם בשאלות ממבחן שלב א׳ או ממבחן מחלקתי? הדביקו אותן כאן יחד עם התשובות הנכונות (אם ידועות).
          הצוות יתקנן אותן בעזרת בינה מלאכותית ויוסיף אותן למאגר. אין צורך בהרשמה —
          משתמשים מחוברים יכולים גם להעלות קובץ PDF או Word במקום הדבקה.
        </p>
      </header>
      <ContributeForm isLoggedIn={isLoggedIn} hospitals={HOSPITALS} chapters={chapters} />
    </div>
  );
}
