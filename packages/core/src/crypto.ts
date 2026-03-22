import { createCipheriv, createDecipheriv } from "node:crypto";

import { createScaffoldModule, type ScaffoldModule } from "./types.js";

const AES_128_ECB_KEY_SIZE = 16;
const AES_BLOCK_SIZE = 16;

function assertAes128Key(key: Buffer): void {
  if (key.length !== AES_128_ECB_KEY_SIZE) {
    throw new Error(`AES-128-ECB requires a 16-byte key, received ${key.length}.`);
  }
}

/**
 * Encrypt media payloads using AES-128-ECB with PKCS#7 padding.
 */
export function encryptAesEcb(data: Buffer, key: Buffer): Buffer {
  assertAes128Key(key);
  const cipher = createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

/**
 * Decrypt media payloads using AES-128-ECB and remove PKCS#7 padding.
 */
export function decryptAesEcb(data: Buffer, key: Buffer): Buffer {
  assertAes128Key(key);
  const decipher = createDecipheriv("aes-128-ecb", key, null);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}

/**
 * Compute the padded ciphertext size for AES-ECB with PKCS#7 padding.
 */
export function aesEcbPaddedSize(size: number): number {
  if (!Number.isInteger(size) || size < 0) {
    throw new Error(`AES padded size requires a non-negative integer, received ${size}.`);
  }

  return Math.ceil((size + 1) / AES_BLOCK_SIZE) * AES_BLOCK_SIZE;
}

/**
 * Parse protocol `aes_key` values which may be encoded as raw bytes or hex bytes in base64.
 */
export function parseAesKey(raw: string): Buffer {
  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === AES_128_ECB_KEY_SIZE) {
    return decoded;
  }

  if (decoded.length > AES_128_ECB_KEY_SIZE) {
    const ascii = decoded.toString("ascii");
    if (/^[0-9a-fA-F]{32}$/.test(ascii)) {
      return Buffer.from(ascii, "hex");
    }
  }

  throw new Error(`Invalid aes_key payload after base64 decode: ${decoded.length} bytes.`);
}

export interface CryptoScaffold {
  readonly packageName: "@openwx/core";
  readonly algorithm: "aes-128-ecb";
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function describeCryptoScaffold(): CryptoScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "AES-128-ECB helpers use Node.js crypto with PKCS#7 padding.",
    "AES key parsing handles both raw bytes and hex-string payloads."
  ]);

  return {
    packageName: "@openwx/core",
    algorithm: "aes-128-ecb",
    status: module.status,
    notes: module.notes
  };
}
