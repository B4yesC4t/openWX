import { describe, expect, it } from "vitest";

import { describeHub } from "../src/index.js";

describe("describeHub", () => {
  it("bundles config with a real router description", () => {
    const hub = describeHub({
      routes: [{ prefix: "/http", handler: "http-proxy" }]
    });

    expect(hub.router.routeCount).toBe(1);
    expect(hub.config.routes[0]?.handler).toBe("http-proxy");
  });
});
