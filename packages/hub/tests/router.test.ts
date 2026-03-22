import { describe, expect, it } from "vitest";

import { createRouter } from "../src/router.js";

describe("createRouter", () => {
  it("counts configured routes and depends on the bot layer", () => {
    const router = createRouter({
      routes: [{ prefix: "/claude", target: { type: "connector", name: "claude-code" } }]
    });

    expect(router.routeCount).toBe(1);
    expect(router.botPackage).toBe("@openwx/bot");
  });
});
