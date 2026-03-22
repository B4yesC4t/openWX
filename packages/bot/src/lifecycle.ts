import * as crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  ILinkClient,
  MessageItemType,
  MessageType,
  UploadMediaType,
  type CDNMedia,
  type GetUploadUrlReq,
  type GetUploadUrlResp,
  type InboundMessage,
  type MessageItem
} from "@openwx/core";

import {
  createMessageContext,
  parseCommand,
  type CommandContext,
  type CommandHandlers,
  type ErrorHandler,
  type MessageContext,
  type MessageHandler,
  type MessageMedia,
  type Reply
} from "./handler.js";

export type BotLifecycleState = "idle" | "starting" | "running" | "stopping" | "stopped";

export interface ReconnectingEvent {
  readonly accountId: string;
  readonly waitMs: number;
}

export interface BotEventMap {
  ready: [];
  message: [ctx: MessageContext];
  error: [error: Error, ctx?: MessageContext];
  stopped: [];
  reconnecting: [event: ReconnectingEvent];
}

export interface Bot extends EventEmitter {
  readonly client: ILinkClient;
  readonly state: BotLifecycleState;
  start(): Promise<void>;
  stop(): Promise<void>;
  on<E extends keyof BotEventMap>(
    eventName: E,
    listener: (...args: BotEventMap[E]) => void
  ): this;
  once<E extends keyof BotEventMap>(
    eventName: E,
    listener: (...args: BotEventMap[E]) => void
  ): this;
  off<E extends keyof BotEventMap>(
    eventName: E,
    listener: (...args: BotEventMap[E]) => void
  ): this;
}

export interface BotClient {
  readonly options: {
    token: string;
    accountId: string;
    cdnBaseUrl: string;
    sessionGuard?: {
      getRemainingMs(accountId: string): number;
    };
  };
  on(eventName: string | symbol, listener: (...args: unknown[]) => void): this;
  off(eventName: string | symbol, listener: (...args: unknown[]) => void): this;
  restoreAccount(accountId?: string): boolean;
  login(): Promise<unknown>;
  startPolling(options?: { signal?: AbortSignal }): Promise<void>;
  sendText(to: string, text: string): Promise<unknown>;
  send(to: string, message: { text?: string; item?: MessageItem }): Promise<unknown>;
  apiFetch<TResponse, TBody extends object = Record<string, unknown>>(
    endpoint: string,
    body?: TBody
  ): Promise<TResponse>;
  dispose(): void;
}

export interface SignalProcess {
  on(eventName: NodeJS.Signals, listener: () => void): this;
  off?(eventName: NodeJS.Signals, listener: () => void): this;
  removeListener?(eventName: NodeJS.Signals, listener: () => void): this;
}

export interface BotLogger {
  warn(message: string, ...args: unknown[]): void;
}

export interface ManagedBotOptions {
  readonly accountId?: string;
  readonly onMessage?: MessageHandler;
  readonly onError?: ErrorHandler;
  readonly commands?: CommandHandlers;
  readonly autoDownloadMedia: boolean;
  readonly clientFactory: () => BotClient;
}

export interface ManagedBotRuntimeOptions {
  readonly process?: SignalProcess;
  readonly logger?: BotLogger;
  readonly handleProcessSignals?: boolean;
  readonly tempDirFactory?: (prefix: string) => Promise<string>;
}

interface MediaSource {
  readonly type: MessageMedia["type"];
  readonly mimeType: string;
  readonly fileName?: string;
  readonly media: CDNMedia;
}

const DEFAULT_MEDIA_PREFIX = "openwx-bot-";
const DEFAULT_SIGNAL_EVENTS: readonly NodeJS.Signals[] = ["SIGINT", "SIGTERM"];
const CDN_UPLOAD_MAX_RETRIES = 3;
const AES_BLOCK_SIZE_BYTES = 16;

const defaultLogger: BotLogger = {
  warn(message: string, ...args: unknown[]) {
    console.warn(message, ...args);
  }
};

export class ManagedBot extends EventEmitter implements Bot {
  private readonly options: ManagedBotOptions;
  private readonly processRef: SignalProcess | undefined;
  private readonly logger: BotLogger;
  private readonly handleProcessSignals: boolean;
  private readonly tempDirFactory: (prefix: string) => Promise<string>;

  private currentClient: BotClient;
  private clientListenersAttached = false;
  private signalHandlersAttached = false;
  private signalHandlers = new Map<NodeJS.Signals, () => void>();
  private abortController: AbortController | undefined;
  private pollingPromise: Promise<void> | undefined;
  private startPromise: Promise<void> | undefined;
  private stopPromise: Promise<void> | undefined;
  private readonly inFlightMessages = new Set<Promise<void>>();
  private currentState: BotLifecycleState = "idle";

  private readonly handleClientMessage = (message: InboundMessage): void => {
    const pending = this.processInboundMessage(message).finally(() => {
      this.inFlightMessages.delete(pending);
    });
    this.inFlightMessages.add(pending);
  };

  private readonly handleClientError = (error: Error): void => {
    this.emitBotError(normalizeError(error));
  };

  private readonly handleClientSessionExpired = (accountId: string): void => {
    const waitMs = this.currentClient.options.sessionGuard?.getRemainingMs(accountId) ?? 0;
    this.emit("reconnecting", {
      accountId,
      waitMs
    });
  };

  constructor(options: ManagedBotOptions, runtime: ManagedBotRuntimeOptions = {}) {
    super();
    this.options = options;
    this.processRef = runtime.process ?? process;
    this.logger = runtime.logger ?? defaultLogger;
    this.handleProcessSignals = runtime.handleProcessSignals ?? true;
    this.tempDirFactory =
      runtime.tempDirFactory ?? ((prefix) => mkdtemp(path.join(os.tmpdir(), prefix)));
    this.currentClient = options.clientFactory();
  }

  get client(): ILinkClient {
    return this.currentClient as ILinkClient;
  }

  get state(): BotLifecycleState {
    return this.currentState;
  }

  on<E extends keyof BotEventMap>(
    eventName: E,
    listener: (...args: BotEventMap[E]) => void
  ): this;
  on(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener);
  }

  once<E extends keyof BotEventMap>(
    eventName: E,
    listener: (...args: BotEventMap[E]) => void
  ): this;
  once(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.once(eventName, listener);
  }

  off<E extends keyof BotEventMap>(
    eventName: E,
    listener: (...args: BotEventMap[E]) => void
  ): this;
  off(eventName: string | symbol, listener: (...args: unknown[]) => void): this {
    return super.off(eventName, listener);
  }

  async start(): Promise<void> {
    if (this.currentState === "running") {
      return;
    }

    if (this.startPromise) {
      await this.startPromise;
      return;
    }

    if (this.stopPromise) {
      await this.stopPromise;
    }

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = undefined;
    });
    await this.startPromise;
  }

  async stop(): Promise<void> {
    if (this.currentState === "stopping" && this.stopPromise) {
      await this.stopPromise;
      return;
    }

    if (this.currentState === "stopped") {
      return;
    }

    this.stopPromise = this.stopInternal().finally(() => {
      this.stopPromise = undefined;
    });
    await this.stopPromise;
  }

  private async startInternal(): Promise<void> {
    this.currentState = "starting";
    this.currentClient = this.options.clientFactory();
    this.attachClientListeners();
    this.attachSignalHandlers();

    try {
      if (!this.currentClient.options.token) {
        const restored = this.currentClient.restoreAccount(this.options.accountId);
        if (!restored) {
          await this.currentClient.login();
        }
      }

      this.abortController = new AbortController();
      const signal = this.abortController.signal;
      this.pollingPromise = this.currentClient
        .startPolling({ signal })
        .catch((error) => {
          if (isAbortError(error) || signal.aborted) {
            return;
          }

          this.emitBotError(normalizeError(error));
          this.currentState = "idle";
        });

      this.currentState = "running";
      this.emit("ready");
    } catch (error) {
      this.detachSignalHandlers();
      this.detachClientListeners();
      this.currentState = "idle";
      throw normalizeError(error);
    }
  }

  private async stopInternal(): Promise<void> {
    const shouldDispose =
      this.currentState === "running" ||
      this.currentState === "starting" ||
      this.currentState === "idle";
    this.currentState = "stopping";
    this.detachSignalHandlers();
    this.abortController?.abort(new DOMException("Bot stopped", "AbortError"));

    if (this.pollingPromise) {
      await this.pollingPromise;
      this.pollingPromise = undefined;
    }

    if (this.inFlightMessages.size > 0) {
      await Promise.allSettled(this.inFlightMessages);
    }

    this.detachClientListeners();

    if (shouldDispose) {
      this.currentClient.dispose();
    }

    this.abortController = undefined;
    this.currentState = "stopped";
    this.emit("stopped");
  }

  private attachClientListeners(): void {
    if (this.clientListenersAttached) {
      return;
    }

    this.currentClient.on("message", this.handleClientMessage as (...args: unknown[]) => void);
    this.currentClient.on("error", this.handleClientError as (...args: unknown[]) => void);
    this.currentClient.on(
      "sessionExpired",
      this.handleClientSessionExpired as (...args: unknown[]) => void
    );
    this.clientListenersAttached = true;
  }

  private detachClientListeners(): void {
    if (!this.clientListenersAttached) {
      return;
    }

    this.currentClient.off("message", this.handleClientMessage as (...args: unknown[]) => void);
    this.currentClient.off("error", this.handleClientError as (...args: unknown[]) => void);
    this.currentClient.off(
      "sessionExpired",
      this.handleClientSessionExpired as (...args: unknown[]) => void
    );
    this.clientListenersAttached = false;
  }

  private attachSignalHandlers(): void {
    if (!this.handleProcessSignals || !this.processRef || this.signalHandlersAttached) {
      return;
    }

    for (const eventName of DEFAULT_SIGNAL_EVENTS) {
      const handler = () => {
        void this.stop();
      };
      this.signalHandlers.set(eventName, handler);
      this.processRef.on(eventName, handler);
    }

    this.signalHandlersAttached = true;
  }

  private detachSignalHandlers(): void {
    if (!this.signalHandlersAttached || !this.processRef) {
      return;
    }

    for (const [eventName, handler] of this.signalHandlers) {
      if (this.processRef.off) {
        this.processRef.off(eventName, handler);
        continue;
      }

      this.processRef.removeListener?.(eventName, handler);
    }

    this.signalHandlers.clear();
    this.signalHandlersAttached = false;
  }

  private async processInboundMessage(message: InboundMessage): Promise<void> {
    if (message.raw.message_type !== MessageType.USER) {
      return;
    }

    let ctx: MessageContext | undefined;

    try {
      ctx = await this.buildMessageContext(message);
      this.emit("message", ctx);
      const reply = await this.routeMessage(ctx);
      await this.dispatchReply(reply, ctx);
    } catch (error) {
      const normalizedError = normalizeError(error);

      if (ctx) {
        await this.handleMessageError(normalizedError, ctx);
        return;
      }

      this.emitBotError(normalizedError);
    }
  }

  private async buildMessageContext(message: InboundMessage): Promise<MessageContext> {
    const userId = message.fromUserId ?? message.raw.from_user_id;
    if (!userId) {
      throw new Error("Inbound message is missing from_user_id.");
    }

    const media = await this.buildMessageMedia(message);

    return createMessageContext({
      message: message.raw,
      userId,
      ...(message.text !== undefined ? { text: message.text } : {}),
      ...(media !== undefined ? { media } : {}),
      client: this.client,
      reply: async (text) => {
        await this.currentClient.sendText(userId, text);
      },
      replyImage: async (filePath) => {
        await this.sendUploadedMedia(userId, filePath, "image");
      },
      replyFile: async (filePath, fileName) => {
        await this.sendUploadedMedia(userId, filePath, "file", fileName);
      }
    });
  }

  private async buildMessageMedia(message: InboundMessage): Promise<MessageMedia | undefined> {
    const mediaSource = extractMediaSource(message);
    if (!mediaSource) {
      return undefined;
    }

    let autoDownloadedFilePath: string | null = null;

    const download = async (): Promise<Buffer> => this.downloadMedia(mediaSource.media);
    const save = async (targetPath: string): Promise<string> => {
      const data = await download();
      await mkdir(path.dirname(targetPath), { recursive: true });
      await writeFile(targetPath, data);
      return targetPath;
    };

    if (this.options.autoDownloadMedia) {
      try {
        const tempDirectory = await this.tempDirFactory(DEFAULT_MEDIA_PREFIX);
        const targetPath = path.join(
          tempDirectory,
          buildTempMediaFileName(mediaSource, message.raw.message_id)
        );
        autoDownloadedFilePath = await save(targetPath);
      } catch (error) {
        autoDownloadedFilePath = null;
        this.logger.warn(
          "Failed to auto-download inbound media for message %s: %s",
          String(message.raw.message_id ?? "unknown"),
          normalizeError(error).message
        );
      }
    }

    return {
      type: mediaSource.type,
      filePath: autoDownloadedFilePath,
      mimeType: mediaSource.mimeType,
      ...(mediaSource.fileName !== undefined ? { fileName: mediaSource.fileName } : {}),
      download,
      save
    };
  }

  private async downloadMedia(media: CDNMedia): Promise<Buffer> {
    if (!media.encrypt_query_param) {
      throw new Error("Inbound media is missing encrypt_query_param.");
    }

    if (!media.aes_key) {
      throw new Error("Inbound media is missing aes_key.");
    }

    const downloadUrl = new URL("/download", `${this.currentClient.options.cdnBaseUrl}/`);
    downloadUrl.searchParams.set("encrypted_query_param", media.encrypt_query_param);

    const response = await fetch(downloadUrl, {
      method: "GET"
    });

    if (!response.ok) {
      throw new Error(`Media download failed with status ${response.status}.`);
    }

    const encryptedBuffer = Buffer.from(await response.arrayBuffer());
    return decryptAesEcb(encryptedBuffer, parseAesKey(media.aes_key));
  }

  private async sendUploadedMedia(
    userId: string,
    filePath: string,
    type: "image" | "file",
    fileName?: string
  ): Promise<void> {
    const plaintext = await readFile(filePath);
    const aesKey = crypto.randomBytes(AES_BLOCK_SIZE_BYTES);
    const aesKeyHex = aesKey.toString("hex");
    const encrypted = encryptAesEcb(plaintext, aesKey);
    const fileKey = crypto.randomBytes(AES_BLOCK_SIZE_BYTES).toString("hex");
    const uploadRequest: GetUploadUrlReq = {
      filekey: fileKey,
      media_type: type === "image" ? UploadMediaType.IMAGE : UploadMediaType.FILE,
      to_user_id: userId,
      rawsize: plaintext.length,
      rawfilemd5: crypto.createHash("md5").update(plaintext).digest("hex"),
      filesize: encrypted.length,
      no_need_thumb: true,
      aeskey: aesKeyHex
    };

    const uploadResponse = await this.currentClient.apiFetch<GetUploadUrlResp, GetUploadUrlReq>(
      "getuploadurl",
      uploadRequest
    );
    if (!uploadResponse.upload_param) {
      throw new Error("getuploadurl did not return upload_param.");
    }

    const downloadParam = await uploadEncryptedMedia(
      this.currentClient.options.cdnBaseUrl,
      uploadResponse.upload_param,
      fileKey,
      encrypted
    );

    const media = {
      encrypt_query_param: downloadParam,
      aes_key: Buffer.from(aesKeyHex, "utf8").toString("base64"),
      encrypt_type: 1
    };

    const item: MessageItem =
      type === "image"
        ? {
            type: MessageItemType.IMAGE,
            image_item: {
              media,
              mid_size: plaintext.length
            }
          }
        : {
            type: MessageItemType.FILE,
            file_item: {
              media,
              file_name: fileName ?? path.basename(filePath),
              len: String(plaintext.length)
            }
          };

    await this.currentClient.send(userId, { item });
  }

  private async routeMessage(ctx: MessageContext): Promise<Reply | void> {
    const commandMatch = parseCommand(ctx.text);
    if (commandMatch) {
      const commandHandler = this.options.commands?.[commandMatch.command];
      if (commandHandler) {
        const commandContext: CommandContext = {
          ...ctx,
          command: commandMatch.command,
          args: commandMatch.args
        };
        return commandHandler(commandContext);
      }
    }

    return this.options.onMessage?.(ctx);
  }

  private async dispatchReply(reply: Reply | void, ctx: MessageContext): Promise<void> {
    if (reply === undefined) {
      return;
    }

    if (typeof reply === "string") {
      await ctx.reply(reply);
      return;
    }

    if ("image" in reply) {
      if (reply.text) {
        await ctx.reply(reply.text);
      }
      await ctx.replyImage(reply.image);
      return;
    }

    if ("file" in reply) {
      if (reply.text) {
        await ctx.reply(reply.text);
      }
      await ctx.replyFile(reply.file, reply.fileName);
      return;
    }

    await ctx.reply(reply.text);
  }

  private async handleMessageError(error: Error, ctx: MessageContext): Promise<void> {
    try {
      await this.options.onError?.(error, ctx);
    } catch (callbackError) {
      this.emitBotError(normalizeError(callbackError), ctx);
    }

    this.emitBotError(error, ctx);
  }

  private emitBotError(error: Error, ctx?: MessageContext): void {
    if (this.listenerCount("error") === 0) {
      return;
    }

    this.emit("error", error, ctx);
  }
}

function extractMediaSource(message: InboundMessage): MediaSource | undefined {
  const item = message.primaryItem;
  switch (message.primaryItemKind) {
    case "image":
      if (!item?.image_item?.media) {
        return undefined;
      }

      return {
        type: "image",
        mimeType: "image/jpeg",
        media: item.image_item.media
      };
    case "video":
      if (!item?.video_item?.media) {
        return undefined;
      }

      return {
        type: "video",
        mimeType: "video/mp4",
        media: item.video_item.media
      };
    case "voice":
      if (!item?.voice_item?.media) {
        return undefined;
      }

      return {
        type: "voice",
        mimeType: "audio/ogg",
        media: item.voice_item.media
      };
    case "file":
      if (!item?.file_item?.media) {
        return undefined;
      }

      return {
        type: "file",
        mimeType: inferMimeType(item.file_item.file_name, "application/octet-stream"),
        ...(item.file_item.file_name !== undefined ? { fileName: item.file_item.file_name } : {}),
        media: item.file_item.media
      };
    default:
      return undefined;
  }
}

function buildTempMediaFileName(media: MediaSource, messageId?: number | string): string {
  const safeFileName = media.fileName?.trim();
  if (safeFileName) {
    return safeFileName;
  }

  const suffix = messageId !== undefined ? String(messageId) : Date.now().toString();
  const extension = mimeTypeToExtension(media.mimeType, media.type);
  return `${media.type}-${suffix}${extension}`;
}

function mimeTypeToExtension(mimeType: string, fallbackType: MessageMedia["type"]): string {
  const normalized = mimeType.toLowerCase();
  switch (normalized) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "video/mp4":
      return ".mp4";
    case "audio/ogg":
      return ".ogg";
    default:
      return fallbackType === "file" ? "" : `.${fallbackType}`;
  }
}

function inferMimeType(fileName: string | undefined, fallback: string): string {
  const extension = fileName ? path.extname(fileName).toLowerCase() : "";
  switch (extension) {
    case ".txt":
      return "text/plain";
    case ".json":
      return "application/json";
    case ".pdf":
      return "application/pdf";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    default:
      return fallback;
  }
}

function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = crypto.createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

function decryptAesEcb(ciphertext: Buffer, key: Buffer): Buffer {
  const decipher = crypto.createDecipheriv("aes-128-ecb", key, null);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function parseAesKey(aesKeyBase64: string): Buffer {
  const decoded = Buffer.from(aesKeyBase64, "base64");
  if (decoded.length === AES_BLOCK_SIZE_BYTES) {
    return decoded;
  }

  const decodedText = decoded.toString("ascii");
  if (decoded.length === AES_BLOCK_SIZE_BYTES * 2 && /^[0-9a-fA-F]{32}$/.test(decodedText)) {
    return Buffer.from(decodedText, "hex");
  }

  throw new Error(`Invalid aes_key length: ${decoded.length}`);
}

async function uploadEncryptedMedia(
  cdnBaseUrl: string,
  uploadParam: string,
  fileKey: string,
  encryptedPayload: Buffer
): Promise<string> {
  const uploadUrl = new URL("/upload", `${cdnBaseUrl}/`);
  uploadUrl.searchParams.set("encrypted_query_param", uploadParam);
  uploadUrl.searchParams.set("filekey", fileKey);

  let attempt = 0;
  while (attempt < CDN_UPLOAD_MAX_RETRIES) {
    attempt += 1;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream"
      },
      body: encryptedPayload
    });

    if (response.ok) {
      const downloadParam = response.headers.get("x-encrypted-param");
      if (!downloadParam) {
        throw new Error("CDN upload response is missing x-encrypted-param.");
      }
      return downloadParam;
    }

    if (response.status < 500 || attempt >= CDN_UPLOAD_MAX_RETRIES) {
      throw new Error(`CDN upload failed with status ${response.status}.`);
    }
  }

  throw new Error("CDN upload failed after retries.");
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
