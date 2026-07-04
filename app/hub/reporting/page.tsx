import { redirect } from "next/navigation";

/** Reporting now lives inside Insights (the "Funder reporting" tab). Keep the old
 *  route working by redirecting  bookmarks and links don't break. */
export default function HubReportingPage() {
  redirect("/hub/insights");
}
