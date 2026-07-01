import { redirect } from "next/navigation";

/** The intake editor moved into the Forms builder (Phase 18.6). */
export default function HubIntakeFormRedirect() {
  redirect("/hub/forms");
}
