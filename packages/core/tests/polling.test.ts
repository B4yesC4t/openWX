import { describe, expect, it } from "vitest";

import { createPollingScaffold } from "../src/polling.js";

describe("createPollingScaffold", () => {
  it("defaults to the protocol long polling timeout", () => {
    expect(createPollingScaffold().timeoutMs).toBe(35_000);
  });
});
