import { describe, expect, it } from "vitest";

import { createMediaScaffold } from "../src/media.js";

describe("createMediaScaffold", () => {
  it("exposes all supported media kinds", () => {
    expect(createMediaScaffold().supportedMedia).toStrictEqual([
      "image",
      "video",
      "file",
      "voice"
    ]);
  });
});
