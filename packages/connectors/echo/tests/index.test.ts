import { describe, expect, it } from "vitest";

import { createEchoConnector } from "../src/index.js";

describe("createEchoConnector", () => {
  it("returns an echo response", async () => {
    const connector = createEchoConnector();

    await expect(
      connector.handle({ conversationId: "1", text: "ping" })
    ).resolves.toStrictEqual({
      text: "Echo: ping"
    });
  });
});
