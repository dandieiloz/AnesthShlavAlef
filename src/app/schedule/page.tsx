import { redirect } from "next/navigation";

export default function ScheduleRedirect() {
  redirect("/progress#plan");
}
