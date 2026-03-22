import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";

import {
  MessageItemType,
  MessageState,
  MessageType,
  type InboundMessage,
  type MessageItem
} from "@openwx/core";

import type { BotClient, SignalProcess } from "../src/lifecycle.js";

export class FakeSignalProcess extends EventEmitter implements SignalProcess {
  off(eventName: NodeJS.Signals, listener: () => void): this {
    super.off(eventName, listener);
    return this;
  }
}

export class FakeClient extends EventEmitter implements BotClient {
  readonly options: BotClient["options"];
  readonly sendTextCalls: Array<{ to: string; text: string }> = [];
  readonly sendCalls: Array<{ to: string; message: { text?: string; item?: MessageItem } }> = [];
  readonly apiFetchCalls: Array<{ endpoint: string; body: unknown }> = [];

  restoreResult = false;
  loginCalls = 0;
  restoreCalls = 0;
  startPollingCalls = 0;
  disposeCalls = 0;
  apiFetchHandler: (endpoint: string, body?: unknown) => Promise<unknown> = async () => ({});

  constructor(token = "bot-token") {
    super();
    this.options = {
      token,
      accountId: "bot-account",
      cdnBaseUrl: "https://cdn.example.com",
      sessionGuard: {
        getRemainingMs: () => 0
      }
    };
  }

  on(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener);
  }

  off(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.off(eventName, listener);
  }

  restoreAccount(): boolean {
    this.restoreCalls += 1;
    if (this.restoreResult) {
      this.options.token = "restored-token";
    }
    return this.restoreResult;
  }

  async login(): Promise<void> {
    this.loginCalls += 1;
    this.options.token = "logged-in-token";
  }

  async startPolling(options?: { signal?: AbortSignal }): Promise<void> {
    this.startPollingCalls += 1;

    await new Promise<void>((resolve) => {
      const signal = options?.signal;
      if (!signal) {
        return;
      }

      if (signal.aborted) {
        resolve();
        return;
      }

      signal.addEventListener("abort", () => resolve(), { once: true });
    });
  }

  async sendText(to: string, text: string): Promise<{ ret: 0 }> {
    this.sendTextCalls.push({ to, text });
    return { ret: 0 };
  }

  async send(
    to: string,
    message: {
      text?: string;
      item?: MessageItem;
    }
  ): Promise<{ ret: 0 }> {
    this.sendCalls.push({ to, message });
    return { ret: 0 };
  }

  async apiFetch<TResponse, TBody extends object = Record<string, unknown>>(
    endpoint: string,
    body?: TBody
  ): Promise<TResponse> {
    this.apiFetchCalls.push({
      endpoint,
      body
    });
    return (await this.apiFetchHandler(endpoint, body)) as TResponse;
  }

  dispose(): void {
    this.disposeCalls += 1;
  }

  emitMessage(message: InboundMessage): void {
    this.emit("message", message);
  }

  emitSessionExpired(accountId = this.options.accountId): void {
    this.emit("sessionExpired", accountId);
  }
}

export function createTextInboundMessage(text: string): InboundMessage {
  const item: MessageItem = {
    type: MessageItemType.TEXT,
    text_item: {
      text
    }
  };
  const raw = {
    from_user_id: "user-1@im.wechat",
    to_user_id: "bot-account@im.bot",
    message_id: 1,
    message_type: MessageType.USER,
    message_state: MessageState.FINISH,
    context_token: "ctx-1",
    item_list: [item]
  };

  return {
    raw,
    fromUserId: raw.from_user_id,
    toUserId: raw.to_user_id,
    contextToken: raw.context_token,
    messageId: raw.message_id,
    itemList: raw.item_list,
    primaryItem: item,
    primaryItemKind: "text",
    text
  };
}

export function createImageInboundFixture(
  plaintext: Buffer
): {
  message: InboundMessage;
  encrypted: Buffer;
} {
  const aesKey = crypto.randomBytes(16);
  const encrypted = encryptAesEcb(plaintext, aesKey);
  const item: MessageItem = {
    type: MessageItemType.IMAGE,
    image_item: {
      media: {
        encrypt_query_param: "download-param",
        aes_key: aesKey.toString("base64"),
        encrypt_type: 1
      }
    }
  };
  const raw = {
    from_user_id: "user-2@im.wechat",
    to_user_id: "bot-account@im.bot",
    message_id: 2,
    message_type: MessageType.USER,
    message_state: MessageState.FINISH,
    context_token: "ctx-2",
    item_list: [item]
  };

  return {
    message: {
      raw,
      fromUserId: raw.from_user_id,
      toUserId: raw.to_user_id,
      contextToken: raw.context_token,
      messageId: raw.message_id,
      itemList: raw.item_list,
      primaryItem: item,
      primaryItemKind: "image"
    },
    encrypted
  };
}

export async function flushAsyncWork(): Promise<void> {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 20));
}

export async function waitForAssertion(
  assertion: () => void | Promise<void>,
  options: {
    readonly timeoutMs?: number;
    readonly intervalMs?: number;
  } = {}
): Promise<void> {
  const timeoutMs = options.timeoutMs ?? 1_000;
  const intervalMs = options.intervalMs ?? 20;
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() <= deadline) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw lastError ?? new Error(`Timed out after ${timeoutMs}ms waiting for assertion.`);
}

function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}
