import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export interface PollingScaffold {
  readonly packageName: "@openwx/core";
  readonly timeoutMs: number;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createPollingScaffold(timeoutMs = 35_000): PollingScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Long polling timeout defaults to 35s.",
    "Persist get_updates_buf before implementing runtime polling."
  ]);

  return {
    packageName: "@openwx/core",
    timeoutMs,
    status: module.status,
    notes: module.notes
  };
}
