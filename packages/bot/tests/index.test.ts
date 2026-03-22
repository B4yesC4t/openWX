import { describe, expect, it } from "vitest";

import { createBot } from "../src/index.js";

describe("bot index", () => {
  it("re-exports createBot", () => {
    expect(createBot({ name: "re-export-check" }).name).toBe("re-export-check");
  });
});
