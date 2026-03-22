import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export interface AuthScaffold {
  readonly packageName: "@openwx/core";
  readonly botType: "3";
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createAuthScaffold(): AuthScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "QR login flow scaffolded.",
    "Bot type is fixed to 3 by protocol requirements."
  ]);

  return {
    packageName: "@openwx/core",
    botType: "3",
    status: module.status,
    notes: module.notes
  };
}
