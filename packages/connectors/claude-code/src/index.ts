import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import type { MessageContext, MessageHandler } from "@openwx/bot";
import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

const DEFAULT_CLAUDE_PATH = "/opt/homebrew/bin/claude";
const DEFAULT_SYSTEM_PROMPT = "你是微信 AI 助手，请使用简洁、自然的纯文本回复用户。";
const DEFAULT_TIMEOUT_MS = 60_000;
const FALLBACK_TEXT = "抱歉，AI 暂时不可用，请稍后再试。";

interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface ClaudeCodeHandlerOptions {
  readonly systemPrompt?: string;
  readonly model?: string;
  readonly timeout?: number;
  readonly cliPath?: string;
}

export function createHandler(options: ClaudeCodeHandlerOptions = {}): MessageHandler {
  const respond = createClaudeResponder(options);

  return async (ctx) =>
    respond({
      conversationId: ctx.userId,
      userMessage: buildUserMessageFromContext(ctx)
    });
}

export function createClaudeCodeConnector(options: ClaudeCodeHandlerOptions = {}): Connector {
  const respond = createClaudeResponder(options);

  return {
    id: "claude-code",
    async handle(request: ConnectorRequest): Promise<ConnectorResponse> {
      return {
        text: await respond({
          conversationId: request.conversationId,
          userMessage: buildUserMessageFromRequest(request)
        })
      };
    }
  };
}

export const createClaudeCodeHandler = createHandler;

function createClaudeResponder(
  options: ClaudeCodeHandlerOptions = {}
): (input: { conversationId: string; userMessage: string }) => Promise<string> {
  const conversationHistory = new Map<string, ConversationTurn[]>();
  const runtimeOptions = normalizeOptions(options);

  return async ({ conversationId, userMessage }) => {
    const history = conversationHistory.get(conversationId) ?? [];
    const prompt = buildPrompt(runtimeOptions.systemPrompt, history, userMessage);
    const response = await runClaude(prompt, runtimeOptions);

    if (response === FALLBACK_TEXT) {
      return FALLBACK_TEXT;
    }

    const plainText = toPlainText(response);
    conversationHistory.set(conversationId, [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: plainText }
    ]);
    return plainText || FALLBACK_TEXT;
  };
}

function normalizeOptions(options: ClaudeCodeHandlerOptions): Required<ClaudeCodeHandlerOptions> {
  return {
    systemPrompt: options.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    model: options.model?.trim() || "",
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    cliPath: options.cliPath?.trim() || resolveClaudeCliPath()
  };
}

function resolveClaudeCliPath(): string {
  return existsSync(DEFAULT_CLAUDE_PATH) ? DEFAULT_CLAUDE_PATH : "claude";
}

function buildUserMessageFromContext(ctx: MessageContext): string {
  const parts: string[] = [];

  if (ctx.text?.trim()) {
    parts.push(ctx.text.trim());
  }

  if (ctx.media) {
    const mediaSummary =
      ctx.media.type === "file"
        ? `收到一个文件消息${ctx.media.fileName ? ` (${ctx.media.fileName})` : ""}`
        : `收到一个${ctx.media.type}消息`;
    parts.push(mediaSummary);
  }

  return parts.join("\n").trim() || "请处理这条空消息。";
}

function buildUserMessageFromRequest(request: ConnectorRequest): string {
  const parts: string[] = [];

  if (request.text.trim()) {
    parts.push(request.text.trim());
  }

  if (request.media) {
    const mediaName = path.basename(request.media.filePath);
    const mediaSummary =
      request.media.type === "file"
        ? `收到一个文件消息${mediaName ? ` (${mediaName})` : ""}`
        : `收到一个${request.media.type}消息`;
    parts.push(mediaSummary);
  }

  return parts.join("\n").trim() || "请处理这条空消息。";
}

function buildPrompt(
  systemPrompt: string,
  history: readonly ConversationTurn[],
  userMessage: string
): string {
  const transcript = history
    .map((turn) => `${turn.role === "user" ? "用户" : "助手"}: ${turn.content}`)
    .join("\n\n");

  return [systemPrompt, transcript, `用户: ${userMessage}`, "助手:"]
    .filter((segment) => segment.trim().length > 0)
    .join("\n\n");
}

function runClaude(
  prompt: string,
  options: Required<ClaudeCodeHandlerOptions>
): Promise<string> {
  return new Promise((resolve) => {
    const command = buildClaudeCommand(options.cliPath, options.model);
    const child = spawn("/bin/bash", ["-lc", command], {
      stdio: ["pipe", "pipe", "pipe"]
    });

    let stdout = "";
    let settled = false;
    const timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      settle(FALLBACK_TEXT);
    }, options.timeout);

    const settle = (result: string): void => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      resolve(result);
    };

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.on("error", () => {
      settle(FALLBACK_TEXT);
    });

    child.on("close", (code) => {
      if (code === 0 && stdout.trim()) {
        settle(stdout.trim());
        return;
      }

      settle(FALLBACK_TEXT);
    });

    child.stdin.end(prompt);
  });
}

function buildClaudeCommand(cliPath: string, model: string): string {
  const parts = [`unset CLAUDECODE; ${quoteShellArg(cliPath)}`, "-p", "--output-format", "text"];

  if (model) {
    parts.push("--model", quoteShellArg(model));
  }

  return parts.join(" ");
}

function quoteShellArg(value: string): string {
  return `'${value.replaceAll("'", "'\"'\"'")}'`;
}

function toPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n/g, "\n")
    .replace(/```([^\n]*)\n([\s\S]*?)```/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export {
  DEFAULT_CLAUDE_PATH,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TIMEOUT_MS,
  FALLBACK_TEXT
};
