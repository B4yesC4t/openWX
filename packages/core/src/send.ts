import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export interface SendScaffold {
  readonly packageName: "@openwx/core";
  readonly maxItemsPerMessage: number;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createSendScaffold(maxItemsPerMessage = 1): SendScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "sendmessage requires context_token passthrough.",
    "Protocol allows one item per outbound message."
  ]);

  return {
    packageName: "@openwx/core",
    maxItemsPerMessage,
    status: module.status,
    notes: module.notes
  };
}
