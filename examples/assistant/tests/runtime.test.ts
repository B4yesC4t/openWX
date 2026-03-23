import { describe, expect, it } from "vitest";

import { createAssistantMessageHandler, describeAssistantMode } from "../src/runtime.js";

describe("assistant runtime", () => {
  it("describes direct-chat Claude mode", () => {
    expect(
      describeAssistantMode({
        provider: "claude-code",
        openRouterModel: "openai/gpt-4.1-mini",
        configPath: "/tmp/assistant.json"
      })
    ).toContain("Claude");
  });

  it("returns help text in multi-app mode when the text has no prefix", async () => {
    const handler = createAssistantMessageHandler({
      provider: "multi-app",
      openRouterModel: "openai/gpt-4.1-mini",
      configPath: "/tmp/assistant.json"
    });

    await expect(
      handler({
        message: {} as never,
        userId: "user-1",
        text: "hello",
        client: {} as never,
        reply: async () => undefined,
        replyImage: async () => undefined,
        replyFile: async () => undefined
      })
    ).resolves.toContain("/claude <问题>");
  });
});
