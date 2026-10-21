import Link from "next/link";
import { requireCompletedProfile } from "@/lib/auth";
import { getLocale, getContentLocale } from "@/lib/locale";
import { getDictionary } from "@/lib/i18n";
import { getMyQuestionCounts } from "@/lib/my-questions";
import { cn } from "@/lib/utils";
import { Play } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { createReviewQuizAction } from "@/app/(user)/review-quiz-actions";
import { HistoryView, type HistorySearchParams } from "./HistoryView";
import { SavedView } from "./SavedView";

type Tab = "all" | "wrong" | "saved";

export default async function MyQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<HistorySearchParams & { tab?: string }>;
}) {
  const me = await requireCompletedProfile();
  const [locale, contentLocale] = await Promise.all([getLocale(), getContentLocale()]);
  const t = getDictionary(locale).myQuestions;
  const sp = await searchParams;
  const tab: Tab = sp.tab === "wrong" || sp.tab === "saved" ? sp.tab : "all";

  const counts = await getMyQuestionCounts(me, contentLocale);

  const tabs: { key: Tab; label: string; count: number; href: string }[] = [
    { key: "all", label: t.tabAll, count: counts.seen, href: "/my-questions" },
    { key: "wrong", label: t.tabWrong, count: counts.wrong, href: "/my-questions?tab=wrong" },
    { key: "saved", label: t.tabSaved, count: counts.saved, href: "/my-questions?tab=saved" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1" aria-label={t.title}>
        {tabs.map((x) => {
          const active = x.key === tab;
          return (
            <Link
              key={x.key}
              href={x.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:flex-initial",
                active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {x.label}
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] tabular-nums",
                  active ? "bg-primary-foreground/20" : "bg-muted",
                )}
              >
                {x.count}
              </span>
            </Link>
          );
        })}
      </nav>

      {tab !== "all" && counts[tab] > 0 && (
        <form action={createReviewQuizAction} className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <input type="hidden" name="reviewSource" value={tab} />
          <SubmitButton size="sm" className="gap-1.5">
            <Play className="h-3.5 w-3.5" />
            {tab === "wrong" ? t.practiceWrong : t.practiceSaved} ({counts[tab]})
          </SubmitButton>
          <Link
            href={`/study/new?mode=review&source=${tab}`}
            className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
          >
            {getDictionary(locale).studyNew.questionCount}…
          </Link>
        </form>
      )}

      {tab === "saved" ? (
        <SavedView me={me} sortParam={sp.sort} locale={locale} contentLocale={contentLocale} />
      ) : (
        <HistoryView me={me} sp={sp} mode={tab} locale={locale} />
      )}
    </div>
  );
}
