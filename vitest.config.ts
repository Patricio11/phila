import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Part-A test harness. Unit tests on the pure logic that carries into Part B,
 * plus the provider-conformance suite that proves `mockProvider` and (later)
 * `dbProvider` satisfy one contract. Node environment  no DOM needed for these.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // vitest isn't an RSC runtime; stub `server-only` so server modules import.
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globals: true,
  },
});
