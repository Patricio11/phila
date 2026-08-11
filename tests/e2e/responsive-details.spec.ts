import { test, expect, type Page } from "@playwright/test";
import { neon } from "@neondatabase/serverless";
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Pass 2 of the responsive audit. "No horizontal scroll" is necessary but not
 * sufficient, so this also checks that the page really rendered (an empty page
 * never overflows), that DIALOGS fit a phone with their buttons reachable, and
 * that wide tables scroll inside their own box rather than being clipped.
 */
const DATABASE_URL = (readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1] ?? "").trim();
const sql = neon(DATABASE_URL);
const PHONE = { width: 390, height: 844 };

const findings: string[] = [];

/** Fail the test that produced them, with the detail attached. */
function assertClean(label: string, from: number) {
  const mine = findings.slice(from);
  expect(mine, `${label}:\n${mine.join("\n")}`).toEqual([]);
}

async function signIn(page: Page, email: string, password = "phila1234") {
  await page.goto("/login");
  await page.getByPlaceholder("you@practice.co.za").fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(/\/(hub|app|me|admin)(\/|$)/, { timeout: 60_000 });
}

/** Did this page actually render something, or is it an error/empty shell? */
async function renderedCheck(page: Page, path: string) {
  const info = await page.evaluate(() => ({
    text: (document.body.innerText ?? "").trim().length,
    headings: document.querySelectorAll("h1,h2,h3").length,
    error: /Application error|something went wrong|Internal Server Error/i.test(document.body.innerText ?? ""),
  }));
  if (info.error) findings.push(`${path} - rendered an error page`);
  else if (info.text < 200 || info.headings === 0) findings.push(`${path} - looks empty (${info.text} chars, ${info.headings} headings)`);
}

/** A dialog must fit the phone: no sideways scroll, and its footer reachable. */
async function dialogCheck(page: Page, label: string) {
  const d = page.getByRole("dialog").last();
  await expect(d).toBeVisible({ timeout: 20_000 });
  const res = await d.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      right: Math.round(r.right), left: Math.round(r.left), width: Math.round(r.width),
      vw: document.documentElement.clientWidth, vh: window.innerHeight,
      bottom: Math.round(r.bottom), scrollable: el.scrollHeight > el.clientHeight + 1,
      pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  if (res.width > res.vw) findings.push(`${label} - dialog is ${res.width}px wide on a ${res.vw}px screen`);
  if (res.left < -1 || res.right > res.vw + 1) findings.push(`${label} - dialog sits off-screen (left=${res.left} right=${res.right} vw=${res.vw})`);
  if (res.pageOver > 1) findings.push(`${label} - page scrolls sideways while the dialog is open (${res.pageOver}px)`);
  // The primary action must be on screen, not below an unscrollable fold.
  const buttons = d.getByRole("button");
  const n = await buttons.count();
  if (n > 0) {
    const last = buttons.nth(n - 1);
    const box = await last.boundingBox();
    if (box && box.y > 844) findings.push(`${label} - its last button sits at y=${Math.round(box.y)}, below a 844px screen`);
  }
}

test("hub dialogs fit a phone", async ({ page }) => {
  const from = findings.length;
  await page.setViewportSize(PHONE);
  await signIn(page, "thandeka@masizakhe.org.za");

  // New appointment - the densest form in the product.
  await page.goto("/hub/appointments");
  await renderedCheck(page, "/hub/appointments");
  await page.getByRole("button", { name: "New", exact: true }).first().click();
  await dialogCheck(page, "hub: New appointment");
  await page.screenshot({ path: "test-results/rwd-new-appointment.png" });
  await page.keyboard.press("Escape");

  // Add client.
  await page.goto("/hub/clients");
  await renderedCheck(page, "/hub/clients");
  await page.getByRole("button", { name: /Add client/ }).first().click();
  await dialogCheck(page, "hub: Add client");
  await page.screenshot({ path: "test-results/rwd-add-client.png" });
  await page.keyboard.press("Escape");

  // Documents: add link, then share (with the note field).
  await page.goto("/hub/documents");
  await renderedCheck(page, "/hub/documents");
  await page.screenshot({ path: "test-results/rwd-documents.png" });
  await page.getByRole("button", { name: /Add link/ }).first().click();
  await dialogCheck(page, "hub: Add link");
  await page.keyboard.press("Escape");

  // The full-profile editor - deliberately A4-sized on a desktop.
  const [member] = await sql`SELECT user_id FROM counsellors WHERE id='couns_nomsa'`;
  await page.goto(`/hub/team/${member!.user_id}`);
  await renderedCheck(page, "/hub/team/[id]");
  await page.getByRole("button", { name: /Edit profile/ }).first().click();
  await dialogCheck(page, "hub: Edit member profile (A4)");
  await page.screenshot({ path: "test-results/rwd-edit-profile.png" });
  await page.keyboard.press("Escape");
  assertClean("hub dialogs", from);
});

test("the client dossier and its export menu fit a phone", async ({ page }) => {
  const from = findings.length;
  await page.setViewportSize(PHONE);
  await signIn(page, "thandeka@masizakhe.org.za");
  const [client] = await sql`SELECT id FROM clients WHERE org_id='org_masizakhe' AND deleted_at IS NULL LIMIT 1`;
  await page.goto(`/hub/clients/${client!.id}`);
  await renderedCheck(page, "/hub/clients/[id]");

  const exportBtn = page.getByRole("button", { name: /^Export/ }).first();
  await expect(exportBtn).toBeVisible({ timeout: 60_000 });
  const menu = page.getByRole("menu", { name: "Export format" });
  await expect(async () => {
    await exportBtn.click();
    await expect(menu).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  // A portaled menu is positioned by hand, so check it landed on screen.
  const box = await menu.boundingBox();
  const vw = PHONE.width;
  if (box && (box.x < 0 || box.x + box.width > vw + 1)) findings.push(`hub: export menu off-screen (x=${Math.round(box.x)} w=${Math.round(box.width)} vw=${vw})`);
  if (box && box.y + box.height > PHONE.height + 1) findings.push(`hub: export menu runs past the bottom (y=${Math.round(box.y)} h=${Math.round(box.height)})`);
  await page.screenshot({ path: "test-results/rwd-export-menu.png" });
  assertClean("client dossier + export menu", from);
});

test("row menus stay on screen on a phone", async ({ page }) => {
  const from = findings.length;
  await page.setViewportSize(PHONE);
  await signIn(page, "thandeka@masizakhe.org.za");
  await page.goto("/hub/documents");
  const kebab = page.getByRole("button", { name: /^Options for/ }).first();
  if (await kebab.count() > 0) {
    await expect(async () => {
      await kebab.click();
      await expect(page.getByRole("menu").last()).toBeVisible({ timeout: 2_000 });
    }).toPass({ timeout: 30_000 });
    const box = await page.getByRole("menu").last().boundingBox();
    if (box && (box.x < 0 || box.x + box.width > PHONE.width + 1)) {
      findings.push(`hub: row menu off-screen (x=${Math.round(box.x)} w=${Math.round(box.width)})`);
    }
    if (box && box.y + box.height > PHONE.height + 1) {
      findings.push(`hub: row menu runs past the bottom (y=${Math.round(box.y)} h=${Math.round(box.height)})`);
    }
    await page.screenshot({ path: "test-results/rwd-row-menu.png" });
  }
  assertClean("row menus", from);
});

test("wide tables scroll inside their own box", async ({ page }) => {
  const from = findings.length;
  await page.setViewportSize(PHONE);
  await signIn(page, "thandeka@masizakhe.org.za");
  for (const path of ["/hub/clients", "/hub/invoicing", "/hub/team", "/hub/insights"]) {
    await page.goto(path);
    await page.waitForTimeout(800);
    await renderedCheck(page, path);
    const clipped = await page.evaluate(() => {
      const out: string[] = [];
      for (const t of Array.from(document.querySelectorAll("table"))) {
        const box = t.getBoundingClientRect();
        let p: HTMLElement | null = t.parentElement;
        let scroller = false;
        while (p && p !== document.body) {
          const ov = getComputedStyle(p).overflowX;
          if (ov === "auto" || ov === "scroll") { scroller = true; break; }
          p = p.parentElement;
        }
        if (!scroller && box.width > document.documentElement.clientWidth + 1) {
          out.push(`table ${Math.round(box.width)}px with no scroller`);
        }
      }
      return out;
    });
    for (const c of clipped) findings.push(`${path} - ${c}`);
  }
  await page.screenshot({ path: "test-results/rwd-clients-phone.png" });
  assertClean("wide tables", from);
});

test("counsellor and client surfaces fit a phone", async ({ page }) => {
  const from = findings.length;
  await page.setViewportSize(PHONE);
  await signIn(page, "nomsa@masizakhe.org.za");
  for (const path of ["/app", "/app/documents", "/app/settings", "/app/appointments"]) {
    await page.goto(path);
    await page.waitForTimeout(700);
    await renderedCheck(page, path);
  }
  await page.screenshot({ path: "test-results/rwd-app-settings.png" });

  // The availability editor: three chips, seven day rows, two time pickers each.
  await page.goto("/app/settings");
  const setUp = page.getByRole("button", { name: "Set availability" });
  if (await setUp.count() > 0) await setUp.click();
  const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (over > 1) findings.push(`/app/settings - availability editor overflows by ${over}px`);
  await page.screenshot({ path: "test-results/rwd-availability.png", fullPage: true });
  assertClean("counsellor + client surfaces", from);
});

test.afterAll(() => {
  const report = findings.length ? findings.join("\n") : "everything checked fits a phone";
  writeFileSync("test-results/responsive-deep-report.txt", report, "utf8");
  console.log(`\n===== DEEP RESPONSIVE REPORT (${findings.length} findings) =====\n${report}\n`);
});
