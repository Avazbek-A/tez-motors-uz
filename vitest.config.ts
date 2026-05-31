import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Unit tests cover the pure money/auth/parsing logic that now governs revenue
// and abuse surfaces. No DOM, no Next runtime — just deterministic functions.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
