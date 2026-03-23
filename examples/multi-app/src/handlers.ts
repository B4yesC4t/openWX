import {
  createClaudeCodeHandler,
  createCodexHandler,
  createEchoHandler,
  createOpenRouterHandler
} from "@openwx/connectors";
import type { MessageHandler } from "@openwx/bot";

import type { ResolvedOpenRouterSettings } from "./runtime-config.js";

export function createMultiAppHandlers(
  openRouter: ResolvedOpenRouterSettings
): Map<string, MessageHandler> {
  return new Map<string, MessageHandler>([
    ["claude-code", createClaudeCodeHandler()],
    ["codex", createCodexHandler()],
    ["echo", createEchoHandler()],
    ["openrouter", createOpenRouterMessageHandler(openRouter)]
  ]);
}

function createOpenRouterMessageHandler(
  settings: ResolvedOpenRouterSettings
): MessageHandler {
  if (!settings.apiKey) {
    return async () =>
      [
        "OpenRouter 尚未配置。",
        "重启当前程序后按提示输入 OpenRouter API Key，或预先设置 OPENROUTER_API_KEY。",
        "配置完成后可使用 /router <问题>。"
      ].join("\n");
  }

  return createOpenRouterHandler({
    apiKey: settings.apiKey,
    model: settings.model
  });
}
