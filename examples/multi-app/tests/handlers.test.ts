import { describe, expect, it } from "vitest";

import { createMultiAppHandlers } from "../src/handlers.js";

describe("createMultiAppHandlers", () => {
  it("keeps the OpenRouter route available even when no API key is configured", async () => {
    const handlers = createMultiAppHandlers({
      model: "openai/gpt-4.1-mini",
      configPath: "/tmp/openwx-test.json"
    });

    const handler = handlers.get("openrouter");

    await expect(
      handler?.({
        message: {} as never,
        userId: "user-1",
        text: "/router hello",
        client: {} as never,
        reply: async () => undefined,
        replyImage: async () => undefined,
        replyFile: async () => undefined
      })
    ).resolves.toContain("OpenRouter 尚未配置");
  });
});
