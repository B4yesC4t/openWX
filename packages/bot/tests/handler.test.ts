import { describe, expect, it } from "vitest";

import { createMessageContext } from "../src/handler.js";

describe("createMessageContext", () => {
  it("creates a minimal bot context", () => {
    expect(createMessageContext("user@im.wechat", "ping")).toStrictEqual({
      from: "user@im.wechat",
      text: "ping"
    });
  });
});
