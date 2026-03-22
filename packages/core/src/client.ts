import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";

import {
  MessageItemType,
  MessageState,
  MessageType,
  type GetConfigReq,
  type GetConfigResp,
  type GetUpdatesResp,
  type ILinkClientEvents,
  type ILinkClientOptions,
  type MessageItem,
  type MessageItemTypeValue,
  type OutboundMessage,
  type PollOptions,
  type PollResult,
  type SendMessageReq,
  type SendMessageResp,
  type SendTypingReq,
  type SendTypingResp,
  type WeixinMessage
} from "./types.js";
import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";
export const DEFAULT_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c";
export const DEFAULT_STORE_DIR = "~/.openwx";
export const DEFAULT_CHANNEL_VERSION = "1.0.0";
export const ILINK_BOT_TYPE = "3";
export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000;
export const DEFAULT_LIGHT_REQUEST_TIMEOUT_MS = 10_000;
export const SESSION_EXPIRED_ERRCODE = -14;

interface ApiFetchOptions {
  readonly timeoutMs?: number;
  readonly requestKind?: "default" | "long-poll" | "light";
  readonly signal?: AbortSignal;
}

interface ResolvedClientOptions {
  baseUrl: string;
  cdnBaseUrl: string;
  token: string;
  storeDir: string;
  skRouteTag: string;
  channelVersion: string;
}

type RequestBody = Record<string, unknown>;

/**
 * Generate the `X-WECHAT-UIN` header value expected by iLink.
 *
 * Important: base64 is applied to the decimal string form of a random uint32,
 * not to the raw 4-byte buffer.
 */
export function randomWechatUin(): string {
  const randomUint32 = crypto.randomBytes(4).readUInt32BE(0);
  const decimalString = String(randomUint32);
  return Buffer.from(decimalString, "utf8").toString("base64");
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is RequestBody {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function inferMessageItemType(item: MessageItem): MessageItemTypeValue {
  if (item.type !== undefined) {
    return item.type;
  }

  if (item.text_item) {
    return MessageItemType.TEXT;
  }

  if (item.image_item) {
    return MessageItemType.IMAGE;
  }

  if (item.voice_item) {
    return MessageItemType.VOICE;
  }

  if (item.file_item) {
    return MessageItemType.FILE;
  }

  if (item.video_item) {
    return MessageItemType.VIDEO;
  }

  throw new Error("Outbound message item is missing a recognizable item payload.");
}

function buildAbortReason(timeoutMs: number): DOMException {
  return new DOMException(`Request timed out after ${timeoutMs}ms`, "AbortError");
}

export class ILinkClient extends EventEmitter {
  readonly packageName = "@openwx/core";
  readonly options: ResolvedClientOptions;

  private readonly contextTokens = new Map<string, string>();
  private readonly activeControllers = new Set<AbortController>();
  private readyEmitted = false;
  private disposed = false;

  constructor(options: ILinkClientOptions = {}) {
    super();
    this.options = {
      baseUrl: trimTrailingSlash(options.baseUrl ?? DEFAULT_BASE_URL),
      cdnBaseUrl: trimTrailingSlash(options.cdnBaseUrl ?? DEFAULT_CDN_BASE_URL),
      token: options.token ?? "",
      storeDir: options.storeDir ?? DEFAULT_STORE_DIR,
      skRouteTag: options.skRouteTag ?? "",
      channelVersion: options.channelVersion ?? DEFAULT_CHANNEL_VERSION
    };
  }

  on<E extends keyof ILinkClientEvents>(
    eventName: E,
    listener: (...args: ILinkClientEvents[E]) => void
  ): this;
  on(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener);
  }

  once<E extends keyof ILinkClientEvents>(
    eventName: E,
    listener: (...args: ILinkClientEvents[E]) => void
  ): this;
  once(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.once(eventName, listener);
  }

  off<E extends keyof ILinkClientEvents>(
    eventName: E,
    listener: (...args: ILinkClientEvents[E]) => void
  ): this;
  off(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.off(eventName, listener);
  }

  emit<E extends keyof ILinkClientEvents>(eventName: E, ...args: ILinkClientEvents[E]): boolean;
  emit(eventName: string | symbol, ...args: unknown[]): boolean {
    return super.emit(eventName, ...args);
  }

  describe(): ScaffoldModule {
    return createScaffoldModule(this.packageName, [
      "ILinkClient now builds authenticated POST requests with protocol defaults.",
      `Default API base: ${this.options.baseUrl}`,
      `Default CDN base: ${this.options.cdnBaseUrl}`
    ]);
  }

  async apiFetch<TResponse, TBody extends object = RequestBody>(
    endpoint: string,
    body: TBody = {} as TBody,
    options: ApiFetchOptions = {}
  ): Promise<TResponse> {
    if (this.disposed) {
      throw new Error("ILinkClient has been disposed.");
    }

    if (!this.options.token) {
      throw new Error("ILinkClient token is required for authenticated iLink requests.");
    }

    const timeoutMs = options.timeoutMs ?? this.resolveTimeout(options.requestKind);
    const controller = new AbortController();
    const onAbort = () => controller.abort(options.signal?.reason ?? buildAbortReason(timeoutMs));
    const timeoutId = setTimeout(() => controller.abort(buildAbortReason(timeoutMs)), timeoutMs);

    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        controller.abort(options.signal.reason ?? buildAbortReason(timeoutMs));
      } else {
        options.signal.addEventListener("abort", onAbort, { once: true });
      }
    }

    this.activeControllers.add(controller);

    try {
      const payload = this.buildPayload(body);
      const serializedBody = JSON.stringify(payload);
      const response = await fetch(this.resolveUrl(endpoint), {
        method: "POST",
        headers: this.buildHeaders(),
        body: serializedBody,
        signal: controller.signal
      });

      if (!response.ok) {
        const responseText = await response.text();
        throw new Error(
          `iLink request failed with status ${response.status}: ${responseText || response.statusText}`
        );
      }

      const text = await response.text();
      const parsed = text.length > 0 ? (JSON.parse(text) as TResponse) : ({} as TResponse);
      this.markReady();
      return parsed;
    } catch (error) {
      this.emitError(error);
      throw error;
    } finally {
      clearTimeout(timeoutId);
      if (options.signal) {
        options.signal.removeEventListener("abort", onAbort);
      }
      this.activeControllers.delete(controller);
    }
  }

  async poll(options: PollOptions = {}): Promise<PollResult> {
    const fetchOptions: {
      requestKind: "long-poll";
      timeoutMs?: number;
      signal?: AbortSignal;
    } = {
      requestKind: "long-poll"
    };

    if (options.timeoutMs !== undefined) {
      fetchOptions.timeoutMs = options.timeoutMs;
    }

    if (options.signal !== undefined) {
      fetchOptions.signal = options.signal;
    }

    const response = await this.apiFetch<GetUpdatesResp>(
      "getupdates",
      {
        get_updates_buf: options.getUpdatesBuf ?? ""
      },
      fetchOptions
    );

    if (response.errcode === SESSION_EXPIRED_ERRCODE) {
      this.emit("sessionExpired");
      return {
        messages: [],
        sessionExpired: true,
        ...(response.get_updates_buf !== undefined
          ? { getUpdatesBuf: response.get_updates_buf }
          : {}),
        ...(response.longpolling_timeout_ms !== undefined
          ? { longPollingTimeoutMs: response.longpolling_timeout_ms }
          : {})
      };
    }

    const messages = response.msgs ?? [];
    this.ingestMessages(messages);

    return {
      messages,
      sessionExpired: false,
      ...(response.get_updates_buf !== undefined
        ? { getUpdatesBuf: response.get_updates_buf }
        : {}),
      ...(response.longpolling_timeout_ms !== undefined
        ? { longPollingTimeoutMs: response.longpolling_timeout_ms }
        : {})
    };
  }

  async send(to: string, message: OutboundMessage): Promise<SendMessageResp> {
    const item = this.buildOutboundItem(message);
    const request: SendMessageReq = {
      msg: {
        from_user_id: "",
        to_user_id: to,
        client_id: message.clientId ?? crypto.randomUUID(),
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        context_token: this.getRequiredContextToken(to),
        item_list: [
          {
            ...item,
            type: inferMessageItemType(item)
          }
        ]
      }
    };

    return this.apiFetch<SendMessageResp, SendMessageReq>("sendmessage", request);
  }

  async sendText(to: string, text: string, clientId?: string): Promise<SendMessageResp> {
    return this.send(to, clientId === undefined ? { text } : { text, clientId });
  }

  async getConfig(request: GetConfigReq): Promise<GetConfigResp> {
    return this.apiFetch<GetConfigResp, GetConfigReq>("getconfig", request, {
      requestKind: "light"
    });
  }

  async sendTyping(request: SendTypingReq): Promise<SendTypingResp> {
    return this.apiFetch<SendTypingResp, SendTypingReq>("sendtyping", request, {
      requestKind: "light"
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    for (const controller of this.activeControllers) {
      controller.abort(new DOMException("ILinkClient disposed", "AbortError"));
    }
    this.activeControllers.clear();
    this.contextTokens.clear();
    this.emit("stopped");
    this.removeAllListeners();
  }

  private resolveTimeout(requestKind: ApiFetchOptions["requestKind"]): number {
    if (requestKind === "light") {
      return DEFAULT_LIGHT_REQUEST_TIMEOUT_MS;
    }

    if (requestKind === "long-poll") {
      return DEFAULT_LONG_POLL_TIMEOUT_MS;
    }

    return DEFAULT_REQUEST_TIMEOUT_MS;
  }

  private resolveUrl(endpoint: string): string {
    if (/^https?:\/\//.test(endpoint)) {
      return endpoint;
    }

    if (endpoint.startsWith("/ilink/")) {
      return new URL(endpoint, `${this.options.baseUrl}/`).toString();
    }

    const normalizedEndpoint = endpoint.replace(/^\/+/, "");
    return new URL(`/ilink/bot/${normalizedEndpoint}`, `${this.options.baseUrl}/`).toString();
  }

  private buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      AuthorizationType: "ilink_bot_token",
      Authorization: `Bearer ${this.options.token}`,
      "X-WECHAT-UIN": randomWechatUin()
    };

    if (this.options.skRouteTag) {
      headers.SKRouteTag = this.options.skRouteTag;
    }

    return headers;
  }

  private buildPayload<TBody extends object>(body: TBody): RequestBody {
    const rawBody = body as RequestBody;
    const baseInfo = isRecord(rawBody.base_info) ? rawBody.base_info : {};

    return {
      ...rawBody,
      base_info: {
        channel_version: this.options.channelVersion,
        ...baseInfo,
        bot_type: ILINK_BOT_TYPE
      }
    };
  }

  private ingestMessages(messages: WeixinMessage[]): void {
    for (const message of messages) {
      if (message.from_user_id && message.context_token) {
        this.contextTokens.set(message.from_user_id, message.context_token);
      }
      this.emit("message", message);
    }
  }

  private getRequiredContextToken(userId: string): string {
    const contextToken = this.contextTokens.get(userId);
    if (!contextToken) {
      throw new Error(
        `No context_token for user ${userId}. Cannot send without receiving a message first.`
      );
    }
    return contextToken;
  }

  private buildOutboundItem(message: OutboundMessage): MessageItem {
    if (message.item && message.text) {
      throw new Error("OutboundMessage cannot provide both text and item.");
    }

    if (message.item) {
      return message.item;
    }

    if (message.text !== undefined) {
      return {
        type: MessageItemType.TEXT,
        text_item: {
          text: message.text
        }
      };
    }

    throw new Error("OutboundMessage requires either text or item.");
  }

  private markReady(): void {
    if (this.readyEmitted) {
      return;
    }

    this.readyEmitted = true;
    this.emit("ready");
  }

  private emitError(error: unknown): void {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    if (this.listenerCount("error") > 0) {
      this.emit("error", normalizedError);
    }
  }
}
