import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { MessageContext, MessageHandler, Reply } from "@openwx/bot";
import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 1;
const DEFAULT_ACK_TEXT = "已收到";
const FALLBACK_TEXT = "抱歉，代理服务暂时不可用，请稍后再试。";

interface ProxyRequestBody {
  readonly conversationId: string;
  readonly text: string;
  readonly media?: {
    readonly type: string;
    readonly url: string;
    readonly fileName?: string;
    readonly mimeType?: string;
  };
}

interface ProxyResponseBody {
  readonly text?: string;
  readonly media?: {
    readonly type: string;
    readonly url: string;
    readonly fileName?: string;
  };
}

export interface HttpProxyHandlerOptions {
  readonly endpoint: string;
  readonly headers?: Record<string, string>;
  readonly timeout?: number;
  readonly retries?: number;
  readonly webhook?: boolean;
}

export function createHandler(options: HttpProxyHandlerOptions): MessageHandler {
  const config = normalizeOptions(options);

  return async (ctx) => {
    const requestBody = await buildHandlerRequestBody(ctx);

    if (config.webhook) {
      void sendWithRetries(config, requestBody).catch(() => undefined);
      return DEFAULT_ACK_TEXT;
    }

    try {
      const response = await sendWithRetries(config, requestBody);
      return await toReply(response, config.timeout);
    } catch {
      return FALLBACK_TEXT;
    }
  };
}

export function createHttpProxyConnector(options: HttpProxyHandlerOptions): Connector {
  const config = normalizeOptions(options);

  return {
    id: "http-proxy",
    async handle(request: ConnectorRequest): Promise<ConnectorResponse> {
      const requestBody = await buildConnectorRequestBody(request);

      if (config.webhook) {
        void sendWithRetries(config, requestBody).catch(() => undefined);
        return {
          text: DEFAULT_ACK_TEXT
        };
      }

      try {
        const response = await sendWithRetries(config, requestBody);
        return toConnectorResponse(response);
      } catch {
        return {
          text: FALLBACK_TEXT
        };
      }
    }
  };
}

export const createHttpProxyHandler = createHandler;

function normalizeOptions(
  options: HttpProxyHandlerOptions
): Required<HttpProxyHandlerOptions> {
  if (!options.endpoint?.trim()) {
    throw new Error("HTTP Proxy connector requires a non-empty endpoint.");
  }

  return {
    endpoint: options.endpoint.replace(/\/+$/, ""),
    headers: options.headers ?? {},
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    retries: options.retries ?? DEFAULT_RETRIES,
    webhook: options.webhook ?? false
  };
}

async function buildHandlerRequestBody(ctx: MessageContext): Promise<ProxyRequestBody> {
  return {
    conversationId: ctx.userId,
    text: ctx.text ?? "",
    ...(ctx.media !== undefined
      ? {
          media: {
            type: ctx.media.type,
            url: await toDataUrl(ctx),
            ...(ctx.media.fileName !== undefined ? { fileName: ctx.media.fileName } : {}),
            mimeType: ctx.media.mimeType
          }
        }
      : {})
  };
}

async function buildConnectorRequestBody(request: ConnectorRequest): Promise<ProxyRequestBody> {
  return {
    conversationId: request.conversationId,
    text: request.text,
    ...(request.media !== undefined
      ? {
          media: {
            type: request.media.type,
            url: await toFileDataUrl(request.media.filePath, request.media.mimeType),
            mimeType: request.media.mimeType
          }
        }
      : {})
  };
}

async function toDataUrl(ctx: MessageContext): Promise<string> {
  if (!ctx.media) {
    throw new Error("Cannot build media payload without media.");
  }

  const buffer = await ctx.media.download();
  return `data:${ctx.media.mimeType};base64,${buffer.toString("base64")}`;
}

async function toFileDataUrl(filePath: string, mimeType: string): Promise<string> {
  const buffer = await readFile(filePath);
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

async function sendWithRetries(
  config: Required<HttpProxyHandlerOptions>,
  requestBody: ProxyRequestBody
): Promise<ProxyResponseBody> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      return await sendRequest(config, requestBody);
    } catch (error) {
      lastError = toError(error);
    }
  }

  throw lastError ?? new Error("HTTP proxy request failed.");
}

async function sendRequest(
  config: Required<HttpProxyHandlerOptions>,
  requestBody: ProxyRequestBody
): Promise<ProxyResponseBody> {
  const response = await fetchWithTimeout(`${config.endpoint}/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...config.headers
    },
    body: JSON.stringify(requestBody)
  }, config.timeout);

  if (!response.ok) {
    throw new Error(`HTTP proxy responded with status ${response.status}.`);
  }

  return (await response.json()) as ProxyResponseBody;
}

async function toReply(
  response: ProxyResponseBody,
  timeout: number
): Promise<Reply | void> {
  if (!response.media?.url) {
    return response.text;
  }

  try {
    const filePath = await downloadRemoteMedia(response.media.url, timeout, response.media.fileName);
    if (response.media.type === "image") {
      return response.text
        ? { text: response.text, image: filePath }
        : { text: "", image: filePath };
    }

    return {
      ...(response.text !== undefined ? { text: response.text } : {}),
      file: filePath,
      ...(response.media.fileName !== undefined ? { fileName: response.media.fileName } : {})
    };
  } catch {
    return response.text ?? FALLBACK_TEXT;
  }
}

function toConnectorResponse(response: ProxyResponseBody): ConnectorResponse {
  if (!response.media?.url) {
    return response.text !== undefined ? { text: response.text } : {};
  }

  return {
    ...(response.text !== undefined ? { text: response.text } : {}),
    media: {
      type: response.media.type,
      url: response.media.url,
      ...(response.media.fileName !== undefined ? { fileName: response.media.fileName } : {})
    }
  };
}

async function downloadRemoteMedia(
  url: string,
  timeout: number,
  fileName?: string
): Promise<string> {
  const response = await fetchWithTimeout(url, { method: "GET" }, timeout);
  if (!response.ok) {
    throw new Error(`Media download failed with status ${response.status}.`);
  }

  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "openwx-http-proxy-"));
  const targetPath = path.join(tempDirectory, fileName ?? inferFileName(url));
  await writeFile(targetPath, Buffer.from(await response.arrayBuffer()));
  return targetPath;
}

function inferFileName(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const candidate = path.basename(pathname);
    return candidate || "attachment.bin";
  } catch {
    return "attachment.bin";
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new Error(`Request timed out after ${timeout}ms.`, {
        cause: error
      });
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export { DEFAULT_TIMEOUT_MS, DEFAULT_RETRIES, DEFAULT_ACK_TEXT, FALLBACK_TEXT };
