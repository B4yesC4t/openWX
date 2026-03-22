import { describe, expect, it } from "vitest";

import { createLifecycleScaffold } from "../src/lifecycle.js";

describe("createLifecycleScaffold", () => {
  it("documents the lifecycle phases", () => {
    expect(createLifecycleScaffold().stages).toStrictEqual([
      "boot",
      "listen",
      "shutdown"
    ]);
  });
});
