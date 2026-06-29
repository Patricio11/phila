/**
 * Apply db/rls.sql to Neon as the owner. Statements are separated by `--##`
 * (so DO blocks stay intact). Run: npm run db:rls
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL not found in .env.local");
const sql = neon(url);

async function main() {
  const file = readFileSync(join(process.cwd(), "db", "rls.sql"), "utf8");
  const statements = file
    .split("--##")
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter((s) => s.length > 0);

  for (const [i, stmt] of statements.entries()) {
    await sql.query(stmt);
    console.log(`✓ [${i + 1}/${statements.length}] ${stmt.split("\n")[0]!.slice(0, 70)}`);
  }
  console.log("RLS applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
