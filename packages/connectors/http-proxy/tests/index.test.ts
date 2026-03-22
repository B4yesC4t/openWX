import { describe, expect, it } from "vitest";

import { createHttpProxyConnector } from "../src/index.js";

describe("createHttpProxyConnector", () => {
  it("captures the target url in the scaffold response", async () => {
    const connector = createHttpProxyConnector({ url: "http://localhost:3000/chat" });

    await expect(
      connector.handle({ conversationId: "1", text: "forward me" })
    ).resolves.toStrictEqual({
      text: "[http-proxy:http://localhost:3000/chat] forward me"
    });
  });
});
