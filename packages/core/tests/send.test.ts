import { describe, expect, it } from "vitest";

import { createSendScaffold } from "../src/send.js";

describe("createSendScaffold", () => {
  it("caps outbound message items to one", () => {
    expect(createSendScaffold().maxItemsPerMessage).toBe(1);
  });
});
