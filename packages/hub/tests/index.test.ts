import { describe, expect, it } from "vitest";

import { createHubScaffold } from "../src/index.js";

describe("createHubScaffold", () => {
  it("bundles config and router scaffold", () => {
    const hub = createHubScaffold({
      routes: [{ prefix: "/http", target: { type: "http", url: "http://localhost:3000" } }]
    });

    expect(hub.router.routeCount).toBe(1);
    expect(hub.config.routes[0]?.target.type).toBe("http");
  });
});
