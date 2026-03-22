import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
  "@openwx/core": fileURLToPath(new URL("../packages/core/src/index.ts", import.meta.url)),
  "@openwx/bot": fileURLToPath(new URL("../packages/bot/src/index.ts", import.meta.url)),
  "@openwx/hub": fileURLToPath(new URL("../packages/hub/src/index.ts", import.meta.url)),
  "@openwx/connectors": fileURLToPath(
    new URL("../packages/connectors/src/index.ts", import.meta.url)
  ),
  "@openwx/connector-claude-code": fileURLToPath(
    new URL("../packages/connectors/claude-code/src/index.ts", import.meta.url)
  ),
  "@openwx/connector-echo": fileURLToPath(
    new URL("../packages/connectors/echo/src/index.ts", import.meta.url)
  ),
  "@openwx/connector-http-proxy": fileURLToPath(
    new URL("../packages/connectors/http-proxy/src/index.ts", import.meta.url)
  )
};

export function createExampleVitestConfig() {
  return defineConfig({
    resolve: {
      alias
    },
    test: {
      environment: "node",
      include: ["tests/**/*.test.ts"],
      passWithNoTests: false
    }
  });
}
