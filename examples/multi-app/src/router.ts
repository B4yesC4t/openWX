import type { HubConfig, RouteTarget } from "@openwx/hub";

import { HELP_COMMAND } from "./config.js";

export interface RouteDecision {
  readonly target: RouteTarget;
  readonly forwardedText: string;
}

export function matchRoute(text: string, config: HubConfig): RouteDecision {
  const normalizedText = text.trim();

  for (const route of config.routes) {
    const prefix = route.prefix?.trim();
    if (!prefix || !normalizedText.startsWith(prefix)) {
      continue;
    }

    return {
      target: route.target,
      forwardedText: normalizedText.slice(prefix.length).trimStart()
    };
  }

  return {
    target: config.defaultRoute ?? { type: "command", command: HELP_COMMAND },
    forwardedText: normalizedText
  };
}

export function buildHelpText(config: HubConfig, routeCount = config.routes.length): string {
  const routeList = config.routes
    .map((route) => `${route.prefix} -> ${describeTarget(route.target)}`)
    .join("\n");

  return [
    `已加载 ${routeCount} 条路由规则。`,
    routeList,
    "默认回复: 发送普通文本会返回这段帮助信息。"
  ].join("\n");
}

function describeTarget(target: RouteTarget): string {
  if (target.type === "connector") {
    return target.name ?? "未命名 connector";
  }

  if (target.type === "http") {
    return target.url ?? "未配置 http url";
  }

  return target.command ?? "未配置 command";
}
