import { readFileSync } from "node:fs";

import { defineHubConfig, type HubConfig } from "@openwx/hub";
import YAML from "yaml";

export function loadHubConfig(filePath: string): HubConfig {
  return parseHubConfig(readFileSync(filePath, "utf8"));
}

export function parseHubConfig(source: string): HubConfig {
  const parsed = YAML.parse(source) as HubConfig;
  return defineHubConfig(parsed);
}
