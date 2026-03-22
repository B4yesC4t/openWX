import { describe, expect, it } from "vitest";

import { createScaffoldModule } from "../src/types.js";

describe("createScaffoldModule", () => {
  it("creates a scaffold status object", () => {
    expect(
      createScaffoldModule("@openwx/core", ["monorepo ready"])
    ).toStrictEqual({
      packageName: "@openwx/core",
      status: "scaffolded",
      notes: ["monorepo ready"]
    });
  });
});
