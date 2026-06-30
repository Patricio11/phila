import { describe, it, expect, afterAll } from "vitest";
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

/** Phase 17 — the public micro-site reads/writes real org_public_pages + records PII-free events. */
const env = readFileSync(".env.local", "utf8");
process.env.DATABASE_URL = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
const sql = neon(process.env.DATABASE_URL!);

import { getPublicPageContent, savePublicPageContent, recordPageEvent, getPageStats } from "@/db/queries/public-page";

const ORG = "org_masizakhe";

afterAll(async () => {
  await sql`DELETE FROM public_page_events WHERE org_id = ${ORG}`;
});

describe("public page content", () => {
  it("reads the seeded rich content", async () => {
    const c = await getPublicPageContent(ORG);
    expect(c).not.toBeNull();
    expect(c!.heroHeadline).toBeTruthy();
    expect(c!.showFaq).toBe(true);
    expect(c!.faqItems.length).toBeGreaterThanOrEqual(3);
    expect(c!.approachItems.length).toBeGreaterThanOrEqual(3);
  });

  it("round-trips an edit (toggle + field) and restores", async () => {
    const before = (await getPublicPageContent(ORG))!;
    await savePublicPageContent(ORG, { ...before, showFaq: false, ctaText: "Start here" });
    const after = (await getPublicPageContent(ORG))!;
    expect(after.showFaq).toBe(false);
    expect(after.ctaText).toBe("Start here");
    await savePublicPageContent(ORG, before); // restore
    expect((await getPublicPageContent(ORG))!.showFaq).toBe(true);
  });
});

describe("PII-free funnel analytics", () => {
  it("records view/book_click/booked and computes conversion", async () => {
    await sql`DELETE FROM public_page_events WHERE org_id = ${ORG}`;
    await recordPageEvent(ORG, "view");
    await recordPageEvent(ORG, "view");
    await recordPageEvent(ORG, "book_click");
    await recordPageEvent(ORG, "booked");
    const s = await getPageStats(ORG, 30);
    expect(s.views).toBe(2);
    expect(s.bookClicks).toBe(1);
    expect(s.booked).toBe(1);
    expect(s.conversion).toBe(50); // 1 booked / 2 views
  });
});
