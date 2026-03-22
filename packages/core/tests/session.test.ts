import { describe, expect, it } from "vitest";

import { createSessionScaffold } from "../src/session.js";

describe("createSessionScaffold", () => {
  it("keeps the one-hour cooldown in the scaffold", () => {
    expect(createSessionScaffold().pauseMs).toBe(3_600_000);
  });
});
