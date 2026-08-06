import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * House style rule: the em-dash (U+2014) is banned across the project. It reads
 * as machine-written; use a plain hyphen, comma, or full stop instead. This test
 * enforces the rule in CI so it can never creep back in. The character is built
 * from its code point so the guard never flags its own source.
 */
const EM_DASH = String.fromCharCode(0x2014);
const ROOTS = ["app", "components", "lib", "db", "docs", "tests", "emails"];
const EXTS = new Set([".ts", ".tsx", ".md", ".sql", ".css", ".mdx", ".txt"]);

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (EXTS.has(p.slice(p.lastIndexOf(".")))) yield p;
  }
}

describe("no em-dash anywhere", () => {
  it("the project contains no U+2014 characters", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      let entries: string[] = [];
      try { entries = [...walk(root)]; } catch { continue; }
      for (const file of entries) {
        const text = readFileSync(file, "utf8");
        if (text.includes(EM_DASH)) {
          const line = text.slice(0, text.indexOf(EM_DASH)).split("\n").length;
          offenders.push(`${file}:${line}`);
        }
      }
    }
    expect(offenders, `Em-dash (U+2014) found in:\n${offenders.join("\n")}\nReplace it with a hyphen, comma, or full stop.`).toEqual([]);
  });
});
