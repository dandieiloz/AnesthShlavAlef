import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { WizardClient } from "./WizardClient";

export default async function NewQuestionWizardPage() {
  await requireAdmin();
  const rows = await db.chapter.findMany({
    orderBy: { number: "asc" },
    select: { number: true, title: true, ingestedAt: true },
  });
  const chapters = rows.map((c) => ({ number: c.number, title: c.title, ingested: c.ingestedAt !== null }));

  return (
    <div>
      <Link href="/admin" className="text-sm text-primary hover:underline">← חזרה לניהול</Link>
      <h1 className="text-2xl font-bold mt-2 mb-4">אשף הוספת שאלה</h1>
      <WizardClient chapters={chapters} />
    </div>
  );
}
