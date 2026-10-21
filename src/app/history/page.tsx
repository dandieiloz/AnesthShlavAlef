import { redirect } from "next/navigation";

/** Old "Questions I've seen" page, now the first tab of /my-questions. */
export default async function HistoryRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") qs.set(k, v);
  const query = qs.toString();
  redirect(query ? `/my-questions?${query}` : "/my-questions");
}
