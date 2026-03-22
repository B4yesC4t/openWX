import { createRouter } from "./router.js";
import { type HubConfig } from "./config.js";

export * from "./config.js";
export * from "./router.js";

export function createHubScaffold(config: HubConfig) {
  return {
    config,
    router: createRouter(config)
  };
}
