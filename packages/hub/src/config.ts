export interface RouteTarget {
  readonly type: "connector" | "http" | "command";
  readonly name?: string;
  readonly url?: string;
  readonly command?: string;
}

export interface RouteConfig {
  readonly prefix?: string;
  readonly target: RouteTarget;
}

export interface HubConfig {
  readonly routes: readonly RouteConfig[];
  readonly defaultRoute?: RouteTarget;
}

export function defineHubConfig(config: HubConfig): HubConfig {
  return config;
}
