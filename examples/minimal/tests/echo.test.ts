import { describe, expect, it } from "vitest";

import { formatEchoReply } from "../src/echo.js";

describe("formatEchoReply", () => {
  it("echoes text content", () => {
    expect(formatEchoReply("hello")).toBe("Echo: hello");
  });

  it("falls back when text is missing", () => {
    expect(formatEchoReply(undefined)).toBe("Echo: 收到一条消息");
  });
});
