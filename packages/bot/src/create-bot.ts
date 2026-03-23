import {
  ILinkClient,
  type BuiltInQRDisplay,
  type QRDisplayProvider
} from "@openwx/core";

import type { CommandHandlers, ErrorHandler, MessageHandler } from "./handler.js";
import {
  ManagedBot,
  type Bot,
  type BotAutoTypingOptions,
  type BotClient,
  type ManagedBotRuntimeOptions,
  resolveAutoTypingOptions
} from "./lifecycle.js";

export interface CreateBotOptions {
  readonly token?: string;
  readonly accountId?: string;
  readonly onMessage?: MessageHandler;
  readonly onError?: ErrorHandler;
  readonly commands?: CommandHandlers;
  readonly storeDir?: string;
  readonly qrDisplay?: BuiltInQRDisplay | QRDisplayProvider;
  readonly autoDownloadMedia?: boolean;
  readonly autoTyping?: boolean | BotAutoTypingOptions;
}

export interface CreateBotRuntimeOptions extends ManagedBotRuntimeOptions {
  readonly clientFactory?: () => BotClient;
}

export function createBot(
  options: CreateBotOptions,
  runtime: CreateBotRuntimeOptions = {}
): Bot {
  validateOptions(options);
  const autoTyping = resolveAutoTypingOptions(options.autoTyping);

  const clientFactory =
    runtime.clientFactory ??
    (() =>
      new ILinkClient({
        ...(options.token !== undefined ? { token: options.token } : {}),
        ...(options.accountId !== undefined ? { accountId: options.accountId } : {}),
        ...(options.storeDir !== undefined ? { storeDir: options.storeDir } : {}),
        ...(options.qrDisplay !== undefined ? { qrDisplay: options.qrDisplay } : {})
      }));

  return new ManagedBot(
    {
      ...(options.accountId !== undefined ? { accountId: options.accountId } : {}),
      ...(options.onMessage !== undefined ? { onMessage: options.onMessage } : {}),
      ...(options.onError !== undefined ? { onError: options.onError } : {}),
      ...(options.commands !== undefined ? { commands: options.commands } : {}),
      autoDownloadMedia: options.autoDownloadMedia ?? false,
      ...(autoTyping !== undefined ? { autoTyping } : {}),
      clientFactory
    },
    runtime
  );
}

function validateOptions(options: CreateBotOptions): void {
  const hasOnMessage = typeof options.onMessage === "function";
  const hasCommands = options.commands !== undefined && Object.keys(options.commands).length > 0;

  if (!hasOnMessage && !hasCommands) {
    throw new Error("createBot requires onMessage or at least one command handler.");
  }

  if (options.token !== undefined && options.token.trim().length === 0) {
    throw new Error("Bot token cannot be empty.");
  }

  if (options.onError !== undefined && typeof options.onError !== "function") {
    throw new Error("onError must be a function.");
  }

  if (options.autoTyping && typeof options.autoTyping === "object") {
    if (
      options.autoTyping.intervalMs !== undefined &&
      (!Number.isFinite(options.autoTyping.intervalMs) || options.autoTyping.intervalMs <= 0)
    ) {
      throw new Error("autoTyping.intervalMs must be a positive number.");
    }
  }

  if (options.commands) {
    for (const [command, handler] of Object.entries(options.commands)) {
      if (!command.startsWith("/")) {
        throw new Error(`Command "${command}" must start with "/".`);
      }

      if (typeof handler !== "function") {
        throw new Error(`Command "${command}" handler must be a function.`);
      }
    }
  }
}
