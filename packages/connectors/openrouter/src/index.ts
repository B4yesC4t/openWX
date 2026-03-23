import { readFile } from "node:fs/promises";
import path from "node:path";

import type { MessageContext, MessageHandler } from "@openwx/bot";
import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

const DEFAULT_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-5.2";
const DEFAULT_SYSTEM_PROMPT = "你是微信里的聊天助手，请用自然、简洁的纯文本回复。";
const DEFAULT_TIMEOUT_MS = 60_000;
const FALLBACK_TEXT = "抱歉，OpenRouter 暂时不可用，请稍后再试。";

interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

interface OpenRouterChatRequest {
  readonly model: string;
  readonly stream: false;
  readonly messages: readonly {
    readonly role: "system" | "user" | "assistant";
    readonly content: string;
  }[];
}

interface OpenRouterChatResponse {
  readonly choices?: readonly {
    readonly message?: {
      readonly content?: string | readonly { readonly type?: string; readonly text?: string }[];
    };
  }[];
}

export interface OpenRouterHandlerOptions {
  readonly apiKey?: string;
  readonly model?: string;
  readonly systemPrompt?: string;
  readonly endpoint?: string;
  readonly timeout?: number;
  readonly siteUrl?: string;
  readonly siteName?: string;
  readonly headers?: Record<string, string>;
}

export function createHandler(options: OpenRouterHandlerOptions = {}): MessageHandler {
  const respond = createOpenRouterResponder(options);

  return async (ctx) =>
    respond({
      conversationId: ctx.userId,
      userMessage: await buildUserMessageFromContext(ctx)
    });
}

export function createOpenRouterConnector(options: OpenRouterHandlerOptions = {}): Connector {
  const respond = createOpenRouterResponder(options);

  return {
    id: "openrouter",
    async handle(request: ConnectorRequest): Promise<ConnectorResponse> {
      return {
        text: await respond({
          conversationId: request.conversationId,
          userMessage: await buildUserMessageFromRequest(request)
        })
      };
    }
  };
}

export const createOpenRouterHandler = createHandler;

function createOpenRouterResponder(
  options: OpenRouterHandlerOptions = {}
): (input: { conversationId: string; userMessage: string }) => Promise<string> {
  const conversationHistory = new Map<string, ConversationTurn[]>();
  const runtimeOptions = normalizeOptions(options);

  return async ({ conversationId, userMessage }) => {
    const history = conversationHistory.get(conversationId) ?? [];

    try {
      const response = await sendCompletion(runtimeOptions, history, userMessage);
      const plainText = normalizeContent(response);
      if (!plainText) {
        return FALLBACK_TEXT;
      }

      conversationHistory.set(conversationId, [
        ...history,
        { role: "user", content: userMessage },
        { role: "assistant", content: plainText }
      ]);
      return plainText;
    } catch {
      return FALLBACK_TEXT;
    }
  };
}

function normalizeOptions(options: OpenRouterHandlerOptions): Required<OpenRouterHandlerOptions> {
  const apiKey = options.apiKey?.trim() || process.env.OPENROUTER_API_KEY?.trim() || "";
  if (!apiKey) {
    throw new Error("OpenRouter connector requires OPENROUTER_API_KEY or options.apiKey.");
  }

  return {
    apiKey,
    model: options.model?.trim() || process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL,
    systemPrompt: options.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    endpoint: options.endpoint?.trim() || DEFAULT_ENDPOINT,
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    siteUrl: options.siteUrl?.trim() || "",
    siteName: options.siteName?.trim() || "",
    headers: options.headers ?? {}
  };
}

async function buildUserMessageFromContext(ctx: MessageContext): Promise<string> {
  const parts: string[] = [];

  if (ctx.text?.trim()) {
    parts.push(ctx.text.trim());
  }

  if (ctx.media) {
    parts.push(await summarizeMedia(ctx.media.type, ctx.media.fileName, ctx.media.mimeType, ctx.media.download));
  }

  return parts.join("\n").trim() || "请处理这条空消息。";
}

async function buildUserMessageFromRequest(request: ConnectorRequest): Promise<string> {
  const parts: string[] = [];

  if (request.text.trim()) {
    parts.push(request.text.trim());
  }

  if (request.media) {
    const media = request.media;
    parts.push(
      await summarizeMedia(
        media.type,
        path.basename(media.filePath),
        media.mimeType,
        async () => readFile(media.filePath)
      )
    );
  }

  return parts.join("\n").trim() || "请处理这条空消息。";
}

async function summarizeMedia(
  type: string,
  fileName: string | undefined,
  mimeType: string,
  load: () => Promise<Buffer>
): Promise<string> {
  if (type === "image") {
    const buffer = await load();
    return `收到一个图片消息 (${mimeType})\n数据: data:${mimeType};base64,${buffer.toString("base64")}`;
  }

  if (type === "file") {
    return `收到一个文件消息${fileName ? ` (${fileName})` : ""}`;
  }

  return `收到一个${type}消息`;
}

async function sendCompletion(
  options: Required<OpenRouterHandlerOptions>,
  history: readonly ConversationTurn[],
  userMessage: string
): Promise<OpenRouterChatResponse> {
  const body: OpenRouterChatRequest = {
    model: options.model,
    stream: false,
    messages: [
      {
        role: "system",
        content: options.systemPrompt
      },
      ...history.flatMap((turn) => [
        {
          role: turn.role,
          content: turn.content
        }
      ]),
      {
        role: "user",
        content: userMessage
      }
    ]
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeout);

  try {
    const response = await fetch(options.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${options.apiKey}`,
        "content-type": "application/json",
        ...(options.siteUrl ? { "http-referer": options.siteUrl } : {}),
        ...(options.siteName ? { "x-openrouter-title": options.siteName } : {}),
        ...options.headers
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OpenRouter responded with status ${response.status}.`);
    }

    return (await response.json()) as OpenRouterChatResponse;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeContent(response: OpenRouterChatResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => item.text?.trim() ?? "")
      .filter((item) => item.length > 0)
      .join("\n")
      .trim();
  }

  return "";
}

export {
  DEFAULT_ENDPOINT,
  DEFAULT_MODEL,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TIMEOUT_MS,
  FALLBACK_TEXT
};
