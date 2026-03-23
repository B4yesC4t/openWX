import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { MessageContext, MessageHandler } from "@openwx/bot";
import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

const DEFAULT_CODEX_PATH = "codex";
const DEFAULT_SYSTEM_PROMPT = "你是微信里的编码助手，请用简洁、自然的纯文本回答。";
const DEFAULT_TIMEOUT_MS = 90_000;
const DEFAULT_SANDBOX_MODE = "read-only";
const FALLBACK_TEXT = "抱歉，Codex 暂时不可用，请稍后再试。";

interface ConversationTurn {
  readonly role: "user" | "assistant";
  readonly content: string;
}

export interface CodexHandlerOptions {
  readonly systemPrompt?: string;
  readonly model?: string;
  readonly timeout?: number;
  readonly cliPath?: string;
  readonly cwd?: string;
  readonly sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  readonly profile?: string;
  readonly skipGitRepoCheck?: boolean;
}

export function createHandler(options: CodexHandlerOptions = {}): MessageHandler {
  const respond = createCodexResponder(options);

  return async (ctx) =>
    respond({
      conversationId: ctx.userId,
      userMessage: buildUserMessageFromContext(ctx)
    });
}

export function createCodexConnector(options: CodexHandlerOptions = {}): Connector {
  const respond = createCodexResponder(options);

  return {
    id: "codex",
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

export const createCodexHandler = createHandler;

function createCodexResponder(
  options: CodexHandlerOptions = {}
): (input: { conversationId: string; userMessage: string }) => Promise<string> {
  const conversationHistory = new Map<string, ConversationTurn[]>();
  const runtimeOptions = normalizeOptions(options);

  return async ({ conversationId, userMessage }) => {
    const history = conversationHistory.get(conversationId) ?? [];
    const prompt = buildPrompt(runtimeOptions.systemPrompt, history, userMessage);
    const response = await runCodex(prompt, runtimeOptions);

    if (response === FALLBACK_TEXT) {
      return FALLBACK_TEXT;
    }

    const plainText = normalizePlainText(response);
    conversationHistory.set(conversationId, [
      ...history,
      { role: "user", content: userMessage },
      { role: "assistant", content: plainText }
    ]);
    return plainText || FALLBACK_TEXT;
  };
}

function normalizeOptions(options: CodexHandlerOptions): Required<CodexHandlerOptions> {
  return {
    systemPrompt: options.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    model: options.model?.trim() || "",
    timeout: options.timeout ?? DEFAULT_TIMEOUT_MS,
    cliPath: options.cliPath?.trim() || resolveCodexCliPath(),
    cwd: options.cwd?.trim() || process.cwd(),
    sandbox: options.sandbox ?? DEFAULT_SANDBOX_MODE,
    profile: options.profile?.trim() || "",
    skipGitRepoCheck: options.skipGitRepoCheck ?? true
  };
}

function resolveCodexCliPath(): string {
  if (existsSync(DEFAULT_CODEX_PATH)) {
    return DEFAULT_CODEX_PATH;
  }

  return DEFAULT_CODEX_PATH;
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
    const fileName = path.basename(request.media.filePath);
    const mediaSummary =
      request.media.type === "file"
        ? `收到一个文件消息${fileName ? ` (${fileName})` : ""}`
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

async function runCodex(
  prompt: string,
  options: Required<CodexHandlerOptions>
): Promise<string> {
  let outputDirectory = "";
  let outputPath = "";

  try {
    outputDirectory = await mkdtemp(path.join(os.tmpdir(), "openwx-codex-"));
    outputPath = path.join(outputDirectory, "last-message.txt");

    return await new Promise<string>((resolve) => {
      const child = spawn(
        options.cliPath,
        buildCodexArgs(options, outputPath),
        {
          cwd: options.cwd,
          stdio: ["pipe", "ignore", "pipe"]
        }
      );

      let stderr = "";
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

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on("error", () => {
        settle(FALLBACK_TEXT);
      });

      child.on("close", async (code) => {
        if (code === 0) {
          try {
            const finalMessage = await readFile(outputPath, "utf8");
            const trimmed = finalMessage.trim();
            settle(trimmed || FALLBACK_TEXT);
            return;
          } catch {
            settle(FALLBACK_TEXT);
            return;
          }
        }

        void stderr;
        settle(FALLBACK_TEXT);
      });

      child.stdin.end(prompt);
    });
  } finally {
    if (outputDirectory) {
      await rm(outputDirectory, { recursive: true, force: true });
    }
  }
}

function buildCodexArgs(
  options: Required<CodexHandlerOptions>,
  outputPath: string
): string[] {
  const args = [
    "exec",
    "--color",
    "never",
    "--output-last-message",
    outputPath,
    "--ephemeral",
    "--sandbox",
    options.sandbox,
    "-C",
    options.cwd
  ];

  if (options.skipGitRepoCheck) {
    args.push("--skip-git-repo-check");
  }

  if (options.model) {
    args.push("--model", options.model);
  }

  if (options.profile) {
    args.push("--profile", options.profile);
  }

  args.push("-");
  return args;
}

function normalizePlainText(markdown: string): string {
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
  DEFAULT_CODEX_PATH,
  DEFAULT_SANDBOX_MODE,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_TIMEOUT_MS,
  FALLBACK_TEXT
};
