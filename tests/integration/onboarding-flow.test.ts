import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/**
 * W1.8b/c  the verification lifecycle end-to-end at the DB layer: company profile
 * save, submit-gate, doc review (with a send-back note), and the admin approve /
 * send-back transitions. No emails are sent here (those live in the actions).
 */
const envFile = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = (envFile.match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
process.env.DATABASE_URL_APP = (envFile.match(/^DATABASE_URL_APP=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(process.env.DATABASE_URL);

import { saveCompanyProfileDb, submitOnboardingDb, upsertOnboardingDocDb, getOrgOnboardingDataDb, getOnboardingStatusDb } from "@/db/queries/onboarding";
import { reviewOnboardingDocDb, approveOrgDb, sendBackOnboardingDb, getOrgAdminContactDb } from "@/db/queries/platform";

const ORG = "org_onb_probe";
const UID = "u_onb_probe";

beforeAll(async () => {
  await sql`INSERT INTO orgs (id, name, slug, province, features, scheduling, client_portal, onboarding_status, created_at)
    VALUES (${ORG}, 'Onboard Probe NPC', 'onboard-probe', 'Gauteng', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, 'not_started', now())
    ON CONFLICT (id) DO UPDATE SET onboarding_status='not_started', profile='{}'::jsonb`;
  await sql`INSERT INTO "user" (id, name, email, email_verified, created_at, updated_at)
    VALUES (${UID}, 'Probe Admin', 'probe.admin@onboard-probe.example', true, now(), now()) ON CONFLICT (id) DO NOTHING`;
  await sql`INSERT INTO org_members (org_id, user_id, team_role, is_supervisor, status, created_at)
    VALUES (${ORG}, ${UID}, 'org_admin', false, 'active', now()) ON CONFLICT DO NOTHING`;
});

afterAll(async () => {
  await sql`DELETE FROM org_onboarding_docs WHERE org_id=${ORG}`;
  await sql`DELETE FROM org_members WHERE org_id=${ORG}`;
  await sql`DELETE FROM "user" WHERE id=${UID}`;
  await sql`DELETE FROM orgs WHERE id=${ORG}`;
});

describe("onboarding lifecycle", () => {
  it("saves the company profile and reflects it", { timeout: 20_000 }, async () => {
    await saveCompanyProfileDb(ORG, "Onboard Probe NPC", {
      registrationNo: "2021/555555/08", infoOfficerName: "Probe Officer",
      infoOfficerEmail: "officer@onboard-probe.example", physicalAddress: "1 Test Road, Johannesburg",
    });
    const data = await getOrgOnboardingDataDb(ORG);
    expect(data?.profile.registrationNo).toBe("2021/555555/08");
    expect(data?.status).toBe("not_started");
  });

  it("refuses to submit until required documents are uploaded, then submits", { timeout: 30_000 }, async () => {
    const early = await submitOnboardingDb(ORG);
    expect(early.ok).toBe(false); // required docs missing

    // Upload all required requirements (owner read tells us which are required).
    const reqs = await sql`SELECT id FROM onboarding_requirements WHERE required = true`;
    for (const r of reqs) {
      await upsertOnboardingDocDb(ORG, r.id as string, { fileName: `${r.id}.pdf`, storageKey: `${ORG}/${r.id}/x.pdf`, bytes: 1024 });
    }
    const ok = await submitOnboardingDb(ORG);
    expect(ok.ok).toBe(true);
    expect(await getOnboardingStatusDb(ORG)).toBe("submitted");
  });

  it("reviews a document with a send-back note", async () => {
    const [firstReq] = await sql`SELECT id FROM onboarding_requirements WHERE required = true ORDER BY sort LIMIT 1`;
    const res = await reviewOnboardingDocDb(ORG, firstReq!.id as string, "reject", "The scan is blurry  please re-upload.");
    expect(res.ok).toBe(true);
    const [row] = await sql`SELECT status, review_note FROM org_onboarding_docs WHERE org_id=${ORG} AND requirement_id=${firstReq!.id}`;
    expect(row!.status).toBe("rejected");
    expect(String(row!.review_note)).toContain("blurry");
  });

  it("approves / sends back the org and resolves the admin contact", async () => {
    const contact = await getOrgAdminContactDb(ORG);
    expect(contact?.email).toBe("probe.admin@onboard-probe.example");
    expect(contact?.orgName).toBe("Onboard Probe NPC");

    expect((await approveOrgDb(ORG)).ok).toBe(true);
    expect(await getOnboardingStatusDb(ORG)).toBe("verified");

    expect((await sendBackOnboardingDb(ORG)).ok).toBe(true);
    expect(await getOnboardingStatusDb(ORG)).toBe("action_needed");
  });
});
