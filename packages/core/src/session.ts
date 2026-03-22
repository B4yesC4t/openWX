import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export interface SessionScaffold {
  readonly packageName: "@openwx/core";
  readonly pauseMs: number;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createSessionScaffold(pauseMs = 60 * 60 * 1000): SessionScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Session expiry errcode -14 requires a one-hour cooldown.",
    "Pause bookkeeping is scaffolded only."
  ]);

  return {
    packageName: "@openwx/core",
    pauseMs,
    status: module.status,
    notes: module.notes
  };
}
