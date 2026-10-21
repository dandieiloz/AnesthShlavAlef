import { redirect } from "next/navigation";

/** Old Bookmarks page, now the "Saved" tab of /my-questions. */
export default function BookmarksRedirect() {
  redirect("/my-questions?tab=saved");
}
