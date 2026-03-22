import { describe, expect, it } from "vitest";

import { describeCryptoScaffold } from "../src/crypto.js";

describe("describeCryptoScaffold", () => {
  it("documents the expected AES mode", () => {
    expect(describeCryptoScaffold().algorithm).toBe("aes-128-ecb");
  });
});
