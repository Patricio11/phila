import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * A measured responsive audit: every surface, at a phone and a tablet width,
 * must not scroll sideways. When it does, this names the widest element so the
 * fix is precise instead of guesswork.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);

const PHONE = { width: 390, height: 844 };   // iPhone 14
const TABLET = { width: 820, height: 1180 }; // iPad Air portrait

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(hub|app|me|admin|funder)(\/|$)/, { timeout: 60_000 });
}

/** The widest offenders on screen, if the page scrolls sideways at all. */
async function overflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = doc.clientWidth;
    const over = doc.scrollWidth - vw;
    if (over <= 1) return { over: 0, culprits: [] as string[] };
    const culprits: string[] = [];
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>("*"))) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right <= vw + 1) continue;
      // Something inside a scroller of its own is fine - that is deliberate.
      let p: HTMLElement | null = el.parentElement;
      let inScroller = false;
      while (p && p !== document.body) {
        const ov = getComputedStyle(p).overflowX;
        if (ov === "auto" || ov === "scroll") { inScroller = true; break; }
        p = p.parentElement;
      }
      if (inScroller) continue;
      const id = `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ""}.${(el.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 4).join(".")}`;
      culprits.push(`${id} [right=${Math.round(r.right)} vw=${vw}] "${(el.textContent ?? "").trim().slice(0, 40)}"`);
      if (culprits.length >= 4) break;
    }
    return { over, culprits };
  });
}

const HUB = [
  "/hub", "/hub/appointments", "/hub/clients", "/hub/insights", "/hub/funders", "/hub/companies",
  "/hub/team", "/hub/supervision", "/hub/messages", "/hub/rooms", "/hub/services", "/hub/documents",
  "/hub/booking", "/hub/forms", "/hub/invoicing", "/hub/billing", "/hub/verification", "/hub/settings",
];
const APP = [
  "/app", "/app/appointments", "/app/clients", "/app/sessions", "/app/forms", "/app/documents",
  "/app/messages", "/app/supervision", "/app/rooms", "/app/settings",
];
const ME = ["/me", "/me/steps", "/me/sessions", "/me/documents", "/me/forms", "/me/billing", "/me/consent", "/me/profile"];
const ADMIN = ["/admin", "/admin/orgs", "/admin/integrations", "/admin/integrations/storage", "/admin/compliance", "/admin/audit", "/admin/plans"];

const findings: string[] = [];

async function sweep(page: Page, label: string, paths: string[]) {
  const before = findings.length;
  for (const size of [PHONE, TABLET]) {
    await page.setViewportSize(size);
    for (const path of paths) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(700); // let the shell settle
      const { over, culprits } = await overflow(page);
      if (over > 1) {
        findings.push(`${size.width}px ${path} - overflows by ${over}px\n    ${culprits.join("\n    ")}`);
      }
    }
  }
  // Fail here, naming the offenders, rather than only writing a report.
  const mine = findings.slice(before);
  expect(mine, `${label} scrolls sideways on a phone or tablet:\n${mine.join("\n")}`).toEqual([]);
}

test("hub is responsive", async ({ page }) => {
  await signIn(page, "thandeka@masizakhe.org.za");
  const [client] = await sql`SELECT id FROM clients WHERE org_id='org_masizakhe' AND deleted_at IS NULL LIMIT 1`;
  const [member] = await sql`SELECT user_id FROM counsellors WHERE id='couns_nomsa'`;
  await sweep(page, "hub", [...HUB, `/hub/clients/${client!.id}`, `/hub/team/${member!.user_id}`]);
});

test("counsellor workspace is responsive", async ({ page }) => {
  await signIn(page, "nomsa@masizakhe.org.za");
  await sweep(page, "app", APP);
});

test("client portal is responsive", async ({ page }) => {
  await signIn(page, "lerato.m@example.co.za");
  await sweep(page, "me", ME);
});

test("admin console is responsive", async ({ page }) => {
  await signIn(page, "ops@philasa.com");
  await sweep(page, "admin", ADMIN);
});

test("public pages are responsive", async ({ page }) => {
  const [org] = await sql`SELECT slug FROM orgs WHERE id='org_masizakhe'`;
  await sweep(page, "public", ["/login", "/signup", `/o/${org!.slug}`, `/o/${org!.slug}/book`]);
});

test.afterAll(() => {
  const report = findings.length ? findings.join("\n") : "no horizontal overflow anywhere";
  writeFileSync("test-results/responsive-report.txt", report, "utf8");
  console.log(`\n===== RESPONSIVE REPORT (${findings.length} findings) =====\n${report}\n`);
});
