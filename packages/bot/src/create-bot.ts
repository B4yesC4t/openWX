import { createCoreScaffold } from "@openwx/core";

import { type BotMessageHandler } from "./handler.js";
import { createLifecycleScaffold } from "./lifecycle.js";

export interface CreateBotOptions {
  readonly name?: string;
  readonly onMessage?: BotMessageHandler;
}

export interface BotScaffold {
  readonly packageName: "@openwx/bot";
  readonly name: string;
  readonly hasHandler: boolean;
  readonly lifecycle: ReturnType<typeof createLifecycleScaffold>;
  readonly core: ReturnType<typeof createCoreScaffold>;
}

export function createBot(options: CreateBotOptions = {}): BotScaffold {
  return {
    packageName: "@openwx/bot",
    name: options.name ?? "openwx-bot",
    hasHandler: typeof options.onMessage === "function",
    lifecycle: createLifecycleScaffold(),
    core: createCoreScaffold()
  };
}
