import { createRouter, type HubConfig, type Router } from "@openwx/hub";

export interface MatchedHandlerRouteDecision {
  readonly kind: "handler";
  readonly handler: string;
  readonly forwardedText: string;
}

export interface HelpRouteDecision {
  readonly kind: "help";
  readonly forwardedText: string;
}

export type RouteDecision = MatchedHandlerRouteDecision | HelpRouteDecision;

export function createExampleRouter(config: HubConfig): Router {
  return createRouter(config);
}

export function matchRoute(text: string, router: Router): RouteDecision {
  const normalizedText = text.trim();
  const match = router.resolve({
    userId: "example-user",
    text: normalizedText
  });

  if (match) {
    return {
      kind: "handler",
      handler: match.route.handler,
      forwardedText: match.request.text
    };
  }

  return {
    kind: "help",
    forwardedText: normalizedText
  };
}

export function buildHelpText(config: HubConfig, routeCount = config.routes.length): string {
  const routeList = config.routes
    .filter((route) => !route.default)
    .map((route) => `${route.prefix} -> ${route.handler}`)
    .join("\n");

  return [
    `已加载 ${routeCount} 条路由规则。`,
    routeList,
    "默认回复: 发送普通文本会返回这段帮助信息。"
  ].join("\n");
}
