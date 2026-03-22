import { describe, expect, it } from "vitest";

import { defineHubConfig } from "../src/config.js";

describe("defineHubConfig", () => {
  it("returns a hub config definition unchanged", () => {
    const config = defineHubConfig({
      routes: [{ prefix: "/echo", target: { type: "connector", name: "echo" } }]
    });

    expect(config.routes).toHaveLength(1);
    expect(config.routes[0]?.target.name).toBe("echo");
  });
});
