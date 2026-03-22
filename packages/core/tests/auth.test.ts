import { describe, expect, it } from "vitest";

import { createAuthScaffold } from "../src/auth.js";

describe("createAuthScaffold", () => {
  it("pins the fixed bot type from the protocol", () => {
    expect(createAuthScaffold().botType).toBe("3");
  });
});
