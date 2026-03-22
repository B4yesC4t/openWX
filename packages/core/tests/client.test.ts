import { describe, expect, it } from "vitest";

import { ILinkClient } from "../src/client.js";

describe("ILinkClient", () => {
  it("uses protocol defaults in the scaffold", () => {
    const client = new ILinkClient();

    expect(client.describe().notes).toContain("Default API base: https://ilinkai.weixin.qq.com");
    expect(client.options.cdnBaseUrl).toBe("https://novac2c.cdn.weixin.qq.com/c2c");
  });
});
