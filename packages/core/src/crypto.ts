import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export interface CryptoScaffold {
  readonly packageName: "@openwx/core";
  readonly algorithm: "aes-128-ecb";
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function describeCryptoScaffold(): CryptoScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "AES key parsing must handle raw bytes and hex-string payloads.",
    "Encryption helpers arrive with protocol implementation."
  ]);

  return {
    packageName: "@openwx/core",
    algorithm: "aes-128-ecb",
    status: module.status,
    notes: module.notes
  };
}
