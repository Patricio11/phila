"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { requireHub } from "@/lib/auth/guard";
import { logAccess } from "@/lib/audit";
import { getStorageProvider, objectKey } from "@/lib/storage";
import { validateUpload } from "@/lib/documents/quota";
import { scanObject } from "@/lib/documents/scan";
import { saveCompanyProfileDb, upsertOnboardingDocDb, submitOnboardingDb, getOnboardingDocKeyDb } from "@/db/queries/onboarding";

/**
 * Company verification onboarding (W1.8b)  the org completes its profile + uploads
 * the admin-set required documents, then submits for review. Bytes go straight to
 * Phila Storage via a presigned URL (never through a Server Action).
 */
const isDb = () => process.env.DATA_PROVIDER === "db";

const profileInput = z.object({
  name: z.string().trim().min(2, "Enter your registered company name."),
  registrationNo: z.string().trim().max(60),
  vatNo: z.string().trim().max(30),
  taxNo: z.string().trim().max(30),
  practiceNo: z.string().trim().max(40),
  infoOfficerName: z.string().trim().max(120),
  infoOfficerEmail: z.string().trim().max(160),
  phone: z.string().trim().max(40),
  website: z.string().trim().max(160),
  physicalAddress: z.string().trim().max(240),
  postalAddress: z.string().trim().max(240),
});

export async function saveCompanyProfile(raw: z.infer<typeof profileInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = profileInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your details." };
  if (parsed.data.infoOfficerEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(parsed.data.infoOfficerEmail)) {
    return { ok: false, error: "Enter a valid Information Officer email." };
  }
  const { name, ...profile } = parsed.data;

  if (isDb()) await saveCompanyProfileDb(membership.orgId, name, profile);
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}/company_profile`, reason: "update_company_profile" });
  revalidatePath("/hub/verification");
  return { ok: true };
}

const uploadInput = z.object({
  requirementId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  contentType: z.string().trim().min(1).max(120),
  bytes: z.number().int().positive(),
});

export async function requestOnboardingUpload(raw: z.infer<typeof uploadInput>): Promise<{ ok: true; uploadUrl: string; storageKey: string } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = uploadInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Check the file." };
  const v = validateUpload({ contentType: parsed.data.contentType, bytes: parsed.data.bytes, name: parsed.data.name });
  if (!v.ok) return v;
  if (!isDb()) return { ok: false, error: "Uploads aren't available in this demo." };

  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Document uploads aren't switched on yet." };

  const key = objectKey(membership.orgId, `onboarding-${parsed.data.requirementId}-${randomUUID().slice(0, 8)}`, parsed.data.name);
  let uploadUrl: string;
  try {
    ({ uploadUrl } = await storage.signedUploadUrl({ key, contentType: parsed.data.contentType }));
  } catch {
    return { ok: false, error: "Storage rejected the upload. Please try again." };
  }
  void principal;
  return { ok: true, uploadUrl, storageKey: key };
}

const confirmInput = z.object({
  requirementId: z.string().min(1),
  name: z.string().trim().min(1).max(160),
  storageKey: z.string().min(1),
  bytes: z.number().int().positive(),
});

export async function confirmOnboardingUpload(raw: z.infer<typeof confirmInput>): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  const parsed = confirmInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Could not finalise the upload." };
  if (!isDb()) return { ok: false, error: "Uploads aren't available in this demo." };

  const scan = await scanObject(parsed.data.storageKey);
  if (scan === "quarantined") return { ok: false, error: "That file didn't pass our safety scan. Try another." };
  await upsertOnboardingDocDb(membership.orgId, parsed.data.requirementId, { fileName: parsed.data.name, storageKey: parsed.data.storageKey, bytes: parsed.data.bytes });
  await logAccess({ action: "file.access", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `onboarding:${parsed.data.requirementId}`, reason: `upload_${scan}` });
  revalidatePath("/hub/verification");
  return { ok: true };
}

export async function submitOnboarding(): Promise<{ ok: true } | { ok: false; error: string }> {
  const { principal, membership } = await requireHub();
  if (!isDb()) return { ok: true };
  const res = await submitOnboardingDb(membership.orgId);
  if (!res.ok) return { ok: false, error: res.error ?? "Could not submit." };
  await logAccess({ action: "admin.action", actor: { userId: principal.userId, platformRole: null, teamRole: "org_admin" }, orgId: membership.orgId, target: `org:${membership.orgId}`, reason: "submit_onboarding" });
  revalidatePath("/hub/verification");
  revalidatePath("/hub");
  return { ok: true };
}

export async function signOnboardingDocDownload(raw: { requirementId: string }): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { membership } = await requireHub();
  if (!isDb()) return { ok: false, error: "Not available in this demo." };
  const key = await getOnboardingDocKeyDb(membership.orgId, String(raw?.requirementId ?? ""));
  if (!key) return { ok: false, error: "Not found." };
  const storage = await getStorageProvider();
  if (storage.status !== "live") return { ok: false, error: "Storage isn't switched on." };
  try {
    return { ok: true, url: await storage.signedDownloadUrl(key) };
  } catch {
    return { ok: false, error: "Could not open the document." };
  }
}
