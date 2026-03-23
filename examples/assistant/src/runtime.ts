import type { MessageHandler } from "@openwx/bot";
import {
  createClaudeCodeHandler,
  createCodexHandler,
  createHttpProxyHandler,
  createOpenRouterHandler
} from "@openwx/connectors";
import { defineHubConfig, createRouter } from "@openwx/hub";

import { createMultiAppHandlers } from "../../multi-app/src/handlers.js";
import type { ResolvedAssistantProfile } from "./setup.js";

const MULTI_APP_CONFIG = defineHubConfig({
  routes: [
    { prefix: "/claude", handler: "claude-code" },
    { prefix: "/codex", handler: "codex" },
    { prefix: "/router", handler: "openrouter" },
    { prefix: "/echo", handler: "echo" }
  ]
});

export function createAssistantMessageHandler(
  profile: ResolvedAssistantProfile
): MessageHandler {
  switch (profile.provider) {
    case "claude-code":
      return createClaudeCodeHandler();
    case "codex":
      return createCodexHandler();
    case "openrouter":
      if (!profile.openRouterApiKey) {
        throw new Error("OpenRouter mode requires an API key.");
      }

      return createOpenRouterHandler({
        apiKey: profile.openRouterApiKey,
        model: profile.openRouterModel
      });
    case "custom-chatbot":
      if (!profile.customEndpoint) {
        throw new Error("Custom chatbot mode requires an endpoint.");
      }

      return createHttpProxyHandler({
        endpoint: profile.customEndpoint
      });
    case "multi-app":
      return createMultiAppModeHandler(profile);
  }
}

export function describeAssistantMode(profile: ResolvedAssistantProfile): string {
  switch (profile.provider) {
    case "claude-code":
      return "当前模式：Claude。直接发送消息即可。";
    case "codex":
      return "当前模式：Codex。直接发送消息即可。";
    case "openrouter":
      return `当前模式：OpenRouter（${profile.openRouterModel}）。直接发送消息即可。`;
    case "custom-chatbot":
      return "当前模式：自定义 chatbot。直接发送消息即可。";
    case "multi-app":
      return [
        "当前模式：多应用接入。",
        "可用前缀：",
        "/claude <问题>",
        "/codex <问题>",
        "/router <问题>",
        "/echo <文本>"
      ].join("\n");
  }
}

function createMultiAppModeHandler(profile: ResolvedAssistantProfile): MessageHandler {
  const router = createRouter(MULTI_APP_CONFIG);
  const handlers = createMultiAppHandlers({
    ...(profile.openRouterApiKey ? { apiKey: profile.openRouterApiKey } : {}),
    model: profile.openRouterModel,
    configPath: profile.configPath
  });

  return async (ctx) => {
    const text = ctx.text?.trim() ?? "";
    const match = router.resolve({
      userId: ctx.userId,
      text
    });

    if (!match) {
      return describeAssistantMode(profile);
    }

    const handler = handlers.get(match.route.handler);
    if (!handler) {
      return `未找到处理器：${match.route.handler}`;
    }

    return handler({
      ...ctx,
      text: match.request.text
    });
  };
}
