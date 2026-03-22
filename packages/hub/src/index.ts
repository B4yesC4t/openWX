import { createHubRuntime } from "./cli.js";
import { type HubConfig } from "./config.js";
import { createRouter } from "./router.js";

export * from "./cli.js";
export * from "./config.js";
export * from "./router.js";

export async function createHub(config: HubConfig) {
  return createHubRuntime(config);
}

export function describeHub(config: HubConfig) {
  return {
    config,
    router: createRouter(config)
  };
}
