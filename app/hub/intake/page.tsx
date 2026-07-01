import { redirect } from "next/navigation";

/** Intake became one form in the Forms library (Phase 18.6). */
export default function HubIntakeRedirect() {
  redirect("/hub/forms");
}
