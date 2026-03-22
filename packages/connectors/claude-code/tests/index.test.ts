import { describe, expect, it } from "vitest";

import { createClaudeCodeConnector } from "../src/index.js";

describe("createClaudeCodeConnector", () => {
  it("returns a connector that echoes scaffold input with an optional prompt prefix", async () => {
    const connector = createClaudeCodeConnector({ systemPrompt: "scaffold" });

    await expect(
      connector.handle({ conversationId: "1", text: "hello" })
    ).resolves.toStrictEqual({
      text: "[scaffold] hello"
    });
  });
});
