import { describe, expect, it } from "vitest";

import { createStoreScaffold } from "../src/store.js";

describe("createStoreScaffold", () => {
  it("points persistence outside the repository", () => {
    expect(createStoreScaffold().accountDir).toBe("~/.openwx/accounts");
  });
});
