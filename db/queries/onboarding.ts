import "server-only";
import { and, eq } from "drizzle-orm";
import { activeDb, runForOrg } from "@/lib/db/scoped";
import { getDb } from "@/db/client";
import { orgs, orgOnboardingDocs, onboardingRequirements } from "@/db/schema";

/**
 * Org-facing verification onboarding (W1.8b). The practice completes its company
 * profile (→ `orgs.profile`) and uploads the admin-set required documents (→
 * `org_onboarding_docs`, org-scoped RLS), then submits for review. Reads/writes run
 * through `runForOrg` so RLS confines them to the caller's org; the platform
 * checklist (`onboarding_requirements`) is read on the owner connection (it's a
 * shared, non-secret catalogue).
 */
export type OnboardingDocStatus = "missing" | "pending" | "verified" | "rejected";

export interface OnboardingDocRow {
  requirementId: string;
  label: string;
  description: string;
  required: boolean;
  status: OnboardingDocStatus;
  fileName: string | null;
  reviewNote: string | null;
  uploadedAt: string | null;
}

export interface OrgOnboardingData {
  name: string;
  status: string;
  submittedAt: string | null;
  profile: Record<string, string>;
  docs: OnboardingDocRow[];
}

/** Company info fields that must be present before a practice can submit for review. */
export const REQUIRED_PROFILE_FIELDS = ["registrationNo", "infoOfficerName", "infoOfficerEmail", "physicalAddress"] as const;

export async function getOrgOnboardingDataDb(orgId: string): Promise<OrgOnboardingData | null> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [org] = await db
      .select({ name: orgs.name, profile: orgs.profile, status: orgs.onboardingStatus, submittedAt: orgs.onboardingSubmittedAt })
      .from(orgs).where(eq(orgs.id, orgId)).limit(1);
    if (!org) return null;
    const reqs = await getDb().select().from(onboardingRequirements).orderBy(onboardingRequirements.sort);
    const docs = await db.select().from(orgOnboardingDocs).where(eq(orgOnboardingDocs.orgId, orgId));
    const docOf = new Map(docs.map((d) => [d.requirementId, d]));
    return {
      name: org.name,
      status: org.status,
      submittedAt: org.submittedAt ? org.submittedAt.toISOString() : null,
      profile: (org.profile as Record<string, string>) ?? {},
      docs: reqs.map((r): OnboardingDocRow => {
        const d = docOf.get(r.id);
        return {
          requirementId: r.id, label: r.label, description: r.description, required: r.required,
          status: (d?.status ?? "missing") as OnboardingDocStatus,
          fileName: d?.fileName ?? null, reviewNote: d?.reviewNote ?? null,
          uploadedAt: d?.uploadedAt ? d.uploadedAt.toISOString() : null,
        };
      }),
    };
  });
}

/** Just the org's verification status — for the hub gate banner (cheap). */
export async function getOnboardingStatusDb(orgId: string): Promise<string> {
  return runForOrg(orgId, async () => {
    const [row] = await activeDb().select({ s: orgs.onboardingStatus }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    return row?.s ?? "not_started";
  });
}

export async function saveCompanyProfileDb(orgId: string, name: string, profile: Record<string, string>): Promise<void> {
  await runForOrg(orgId, async () => {
    const db = activeDb();
    const [org] = await db.select({ profile: orgs.profile }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    const merged = { ...((org?.profile as Record<string, string>) ?? {}), ...profile };
    await db.update(orgs).set({ name, profile: merged }).where(eq(orgs.id, orgId));
  });
}

/** Record an uploaded document (or replace an existing/rejected one) as pending review. */
export async function upsertOnboardingDocDb(orgId: string, requirementId: string, input: { fileName: string; storageKey: string; bytes: number }): Promise<void> {
  const now = new Date();
  await runForOrg(orgId, () =>
    activeDb().insert(orgOnboardingDocs)
      .values({ orgId, requirementId, status: "pending", fileName: input.fileName, storageKey: input.storageKey, bytes: input.bytes, reviewNote: null, uploadedAt: now })
      .onConflictDoUpdate({
        target: [orgOnboardingDocs.orgId, orgOnboardingDocs.requirementId],
        set: { status: "pending", fileName: input.fileName, storageKey: input.storageKey, bytes: input.bytes, reviewNote: null, uploadedAt: now },
      }),
  );
}

/** The storage key for one of the org's own onboarding docs (for a signed download). */
export async function getOnboardingDocKeyDb(orgId: string, requirementId: string): Promise<string | null> {
  return runForOrg(orgId, async () => {
    const [row] = await activeDb().select({ key: orgOnboardingDocs.storageKey }).from(orgOnboardingDocs)
      .where(and(eq(orgOnboardingDocs.orgId, orgId), eq(orgOnboardingDocs.requirementId, requirementId))).limit(1);
    return row?.key ?? null;
  });
}

/** Submit the onboarding for review — requires the core company fields + all required docs. */
export async function submitOnboardingDb(orgId: string): Promise<{ ok: boolean; error?: string }> {
  return runForOrg(orgId, async () => {
    const db = activeDb();
    const [org] = await db.select({ profile: orgs.profile }).from(orgs).where(eq(orgs.id, orgId)).limit(1);
    const profile = (org?.profile as Record<string, string>) ?? {};
    if (REQUIRED_PROFILE_FIELDS.some((f) => !(profile[f] ?? "").trim())) {
      return { ok: false, error: "Complete your company information first." };
    }
    const reqs = await getDb().select({ id: onboardingRequirements.id }).from(onboardingRequirements).where(eq(onboardingRequirements.required, true));
    const docs = await db.select().from(orgOnboardingDocs).where(eq(orgOnboardingDocs.orgId, orgId));
    const have = new Set(docs.filter((d) => d.status !== "rejected" && d.storageKey).map((d) => d.requirementId));
    const missing = reqs.filter((r) => !have.has(r.id));
    if (missing.length) return { ok: false, error: `Upload all required documents (${missing.length} still to go).` };
    await db.update(orgs).set({ onboardingStatus: "submitted", onboardingSubmittedAt: new Date() }).where(eq(orgs.id, orgId));
    return { ok: true };
  });
}
