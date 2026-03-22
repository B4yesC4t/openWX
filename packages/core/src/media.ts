import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export interface MediaScaffold {
  readonly packageName: "@openwx/core";
  readonly supportedMedia: readonly ["image", "video", "file", "voice"];
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createMediaScaffold(): MediaScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Media transport uses AES-128-ECB.",
    "CDN upload and download adapters are deferred."
  ]);

  return {
    packageName: "@openwx/core",
    supportedMedia: ["image", "video", "file", "voice"],
    status: module.status,
    notes: module.notes
  };
}
