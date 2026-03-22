import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "repo",
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["packages/**"],
    passWithNoTests: false
  }
});
