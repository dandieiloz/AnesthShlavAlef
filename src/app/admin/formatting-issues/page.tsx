import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "../AdminNav";
import { FormattingIssuesClient } from "./FormattingIssuesClient";

export default async function FormattingIssuesPage() {
  await requireAdmin();
  return (
    <div className="space-y-4">
      <AdminNav />
      <div>
        <h1 className="text-2xl font-bold">בעיות עיצוב</h1>
        <p className="text-sm text-muted-foreground">
          סורק את מאגר השאלות והתשובות ומאתר בעיות עיצוב/רינדור (כמו תווי בריחה מילוליים שמשבשים את
          הצגת ה-KaTeX), עם הצעת תיקון לכל בעיה.
        </p>
      </div>
      <FormattingIssuesClient />
    </div>
  );
}
