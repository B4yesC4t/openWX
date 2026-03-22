import { describe, expect, it } from "vitest";

import { createCoreScaffold } from "../src/index.js";

describe("createCoreScaffold", () => {
  it("aggregates the core module skeleton", () => {
    const scaffold = createCoreScaffold();

    expect(scaffold.auth.botType).toBe("3");
    expect(scaffold.polling.timeoutMs).toBe(35_000);
    expect(scaffold.store.accountDir).toBe("~/.openwx/accounts");
  });
});
