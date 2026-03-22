import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  aesEcbPaddedSize,
  decryptAesEcb,
  describeCryptoScaffold,
  encryptAesEcb,
  parseAesKey
} from "../src/crypto.js";

describe("crypto helpers", () => {
  it("documents the expected AES mode", () => {
    expect(describeCryptoScaffold().algorithm).toBe("aes-128-ecb");
  });

  it("round-trips AES-128-ECB data with PKCS#7 padding", () => {
    const key = Buffer.from("0123456789abcdef");
    const plain = Buffer.from("Hello, WeChat!");
    const cipher = encryptAesEcb(plain, key);

    expect(cipher.length).toBe(16);
    expect(decryptAesEcb(cipher, key)).toStrictEqual(plain);
  });

  it("calculates padded ciphertext sizes", () => {
    expect(aesEcbPaddedSize(0)).toBe(16);
    expect(aesEcbPaddedSize(15)).toBe(16);
    expect(aesEcbPaddedSize(16)).toBe(32);
    expect(aesEcbPaddedSize(17)).toBe(32);
  });

  it("parses raw 16-byte aes_key payloads", () => {
    const raw = randomBytes(16);
    expect(parseAesKey(raw.toString("base64"))).toStrictEqual(raw);
  });

  it("parses base64-encoded hex-string aes_key payloads", () => {
    const raw = randomBytes(16);
    const encoded = Buffer.from(raw.toString("hex"), "ascii").toString("base64");

    expect(parseAesKey(encoded)).toStrictEqual(raw);
  });
});
