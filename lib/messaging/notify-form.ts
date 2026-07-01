import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { clients, orgs } from "@/db/schema";
import { deliver } from "@/lib/messaging/deliver";

/**
 * Form notifications (Phase 18.6)  "a form is waiting for you" with the public
 * fill link. Routed through the Phase-12 deliver chokepoint (consent / opt-out /
 * quiet-hours / credits honoured; dormant channels never fake a send). Never
 * throws  a notification failure must not break the send action.
 */
const BASE = process.env.BETTER_AUTH_URL ?? "https://philasa.com";

export async function notifyFormSent(
  orgId: string,
  formName: string,
  sends: { clientId: string; token: string }[],
): Promise<void> {
  try {
    const db = getDb();
    const [org] = await db.select({ name: orgs.name }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    for (const s of sends) {
      const [c] = await db
        .select({ name: clients.name, phone: clients.phone, email: clients.email })
        .from(clients).where(eq(clients.id, s.clientId)).limit(1);
      if (!c) continue;
      await deliver({
        orgId,
        trigger: "form_sent",
        ref: `formsend:${s.token}`,
        recipient: { phone: c.phone, email: c.email, preferredContact: null },
        vars: {
          clientName: (c.name ?? "there").split(" ")[0] ?? "there",
          practiceName: org?.name ?? "your practice",
          formName,
          formLink: `${BASE}/f/${s.token}`,
          serviceName: "", counsellorName: "", date: "", time: "",
        },
      });
    }
  } catch {
    /* notifications never break the action */
  }
}
