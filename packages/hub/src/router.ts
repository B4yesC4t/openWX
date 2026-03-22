import { type HubConfig } from "./config.js";

export interface RouterScaffold {
  readonly packageName: "@openwx/hub";
  readonly routeCount: number;
  readonly botPackage: string;
}

export function createRouter(config: HubConfig): RouterScaffold {
  return {
    packageName: "@openwx/hub",
    routeCount: config.routes.length,
    botPackage: "@openwx/bot"
  };
}
