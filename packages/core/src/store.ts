import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export interface StoreScaffold {
  readonly packageName: "@openwx/core";
  readonly accountDir: string;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createStoreScaffold(accountDir = "~/.openwx/accounts"): StoreScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Persist tokens and get_updates_buf outside the repo.",
    "Filesystem adapter lands in a dedicated issue."
  ]);

  return {
    packageName: "@openwx/core",
    accountDir,
    status: module.status,
    notes: module.notes
  };
}
