import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

import { type HubConfig, type HubRouteConfig } from "./config.js";

export interface HubRouterLogger {
  warn(message: string): void;
}

export interface HubRouteMessage {
  readonly userId: string;
  readonly text?: string;
  readonly conversationId?: string;
  readonly media?: ConnectorRequest["media"];
}

export interface RouteMatch {
  readonly routeIndex: number;
  readonly route: HubRouteConfig;
  readonly request: ConnectorRequest;
}

export interface RouterOptions {
  readonly logger?: HubRouterLogger;
}

interface PreparedRoute {
  readonly index: number;
  readonly route: HubRouteConfig;
  readonly regex?: RegExp;
}

export class Router {
  readonly packageName = "@openwx/hub";
  readonly botPackage = "@openwx/bot";
  readonly warnings: readonly string[];

  private readonly routes: readonly PreparedRoute[];

  constructor(config: HubConfig, options: RouterOptions = {}) {
    this.routes = config.routes.map((route, index) => ({
      index,
      route,
      ...(route.pattern !== undefined ? { regex: new RegExp(route.pattern) } : {})
    }));
    this.warnings = detectRouteConflicts(config.routes);

    for (const warning of this.warnings) {
      options.logger?.warn(warning);
    }
  }

  get routeCount(): number {
    return this.routes.length;
  }

  resolve(message: HubRouteMessage): RouteMatch | null {
    const conversationId = message.conversationId ?? message.userId;

    for (const preparedRoute of this.routes) {
      const normalizedText = this.matchRoute(preparedRoute, message.text, message.userId);
      if (normalizedText === null) {
        continue;
      }

      return {
        routeIndex: preparedRoute.index,
        route: preparedRoute.route,
        request: {
          conversationId,
          text: normalizedText,
          ...(message.media !== undefined ? { media: message.media } : {})
        }
      };
    }

    return null;
  }

  async dispatch(
    message: HubRouteMessage,
    handlers: ReadonlyMap<number, Connector>
  ): Promise<ConnectorResponse | null> {
    const match = this.resolve(message);
    if (!match) {
      return null;
    }

    const handler = handlers.get(match.routeIndex);
    if (!handler) {
      throw new Error(`No handler registered for route #${match.routeIndex + 1}.`);
    }

    return handler.handle(match.request);
  }

  private matchRoute(
    preparedRoute: PreparedRoute,
    text: string | undefined,
    userId: string
  ): string | null {
    const { route } = preparedRoute;

    if (route.default) {
      return text ?? "";
    }

    if (route.users) {
      return route.users.includes(userId) ? (text ?? "") : null;
    }

    if (route.prefix) {
      const stripped = matchPrefix(route.prefix, text);
      if (stripped === null) {
        return null;
      }

      return route.stripPrefix === false ? (text ?? "") : stripped;
    }

    if (route.keywords) {
      if (!text) {
        return null;
      }

      return route.keywords.some((keyword) => text.includes(keyword)) ? text : null;
    }

    if (route.pattern && preparedRoute.regex) {
      if (!text) {
        return null;
      }

      return preparedRoute.regex.test(text) ? text : null;
    }

    return null;
  }
}

export function createRouter(config: HubConfig, options: RouterOptions = {}): Router {
  return new Router(config, options);
}

export function detectRouteConflicts(routes: readonly HubRouteConfig[]): string[] {
  const warnings: string[] = [];

  for (const [index, route] of routes.entries()) {
    if (route.default && index < routes.length - 1) {
      warnings.push(
        `Route #${index + 1} is a default route but is not last; later routes will never match.`
      );
    }
  }

  for (const [leftIndex, leftRoute] of routes.entries()) {
    for (const [rightIndex, rightRoute] of routes.entries()) {
      if (rightIndex <= leftIndex) {
        continue;
      }

      if (
        leftRoute.prefix !== undefined &&
        rightRoute.prefix !== undefined &&
        leftRoute.prefix === rightRoute.prefix
      ) {
        warnings.push(
          `Routes #${leftIndex + 1} and #${rightIndex + 1} share the same prefix "${leftRoute.prefix}".`
        );
      }

      if (leftRoute.pattern !== undefined && rightRoute.pattern !== undefined) {
        if (leftRoute.pattern === rightRoute.pattern) {
          warnings.push(
            `Routes #${leftIndex + 1} and #${rightIndex + 1} share the same regular expression "${leftRoute.pattern}".`
          );
        }
      }

      const overlappingUsers = intersection(leftRoute.users, rightRoute.users);
      if (overlappingUsers.length > 0) {
        warnings.push(
          `Routes #${leftIndex + 1} and #${rightIndex + 1} overlap on users: ${overlappingUsers.join(", ")}.`
        );
      }

      const overlappingKeywords = intersection(leftRoute.keywords, rightRoute.keywords);
      if (overlappingKeywords.length > 0) {
        warnings.push(
          `Routes #${leftIndex + 1} and #${rightIndex + 1} overlap on keywords: ${overlappingKeywords.join(", ")}.`
        );
      }
    }
  }

  return warnings;
}

function matchPrefix(prefix: string, text: string | undefined): string | null {
  if (!text) {
    return null;
  }

  if (text === prefix) {
    return "";
  }

  if (!text.startsWith(prefix)) {
    return null;
  }

  const nextCharacter = text[prefix.length];
  if (nextCharacter === undefined || !/\s/.test(nextCharacter)) {
    return null;
  }

  return text.slice(prefix.length).trimStart();
}

function intersection(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined
): string[] {
  if (!left || !right) {
    return [];
  }

  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}
