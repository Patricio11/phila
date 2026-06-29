/**
 * Apply a delimited .sql file to Neon as the owner. Statements are separated by
 * `--##` (so DO blocks / dollar-quoted bodies stay intact).
 * Usage: tsx db/apply-sql.ts db/rls.sql
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const url = readFileSync(".env.local", "utf8").match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL not found in .env.local");
const sql = neon(url);

const file: string = process.argv[2] ?? "";
if (!file) throw new Error("usage: tsx db/apply-sql.ts <file.sql>");

async function main() {
  const text = readFileSync(join(process.cwd(), file), "utf8");
  const statements = text
    .split("--##")
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter((s) => s.length > 0);

  for (const [i, stmt] of statements.entries()) {
    await sql.query(stmt);
    console.log(`✓ [${i + 1}/${statements.length}] ${stmt.split("\n")[0]!.slice(0, 70)}`);
  }
  console.log(`Applied ${file}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
