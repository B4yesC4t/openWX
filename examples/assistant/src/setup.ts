import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as defaultStdin, stdout as defaultStdout } from "node:process";

export type AssistantProvider =
  | "claude-code"
  | "codex"
  | "openrouter"
  | "custom-chatbot"
  | "multi-app";

export interface AssistantProfile {
  readonly provider: AssistantProvider;
  readonly openRouterApiKey?: string;
  readonly openRouterModel?: string;
  readonly customEndpoint?: string;
}

export interface ResolvedAssistantProfile {
  readonly provider: AssistantProvider;
  readonly openRouterApiKey?: string;
  readonly openRouterModel: string;
  readonly customEndpoint?: string;
  readonly configPath: string;
}

export interface ResolveAssistantProfileOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly configPath?: string;
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly isInteractive?: boolean;
}

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4.1-mini";
const PROVIDER_CHOICES: ReadonlyArray<{
  readonly id: AssistantProvider;
  readonly label: string;
}> = [
  { id: "claude-code", label: "Claude" },
  { id: "codex", label: "Codex" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "custom-chatbot", label: "自定义 chatbot" },
  { id: "multi-app", label: "多应用接入" }
] as const;

export function resolveDefaultAssistantConfigPath(): string {
  return path.join(os.homedir(), ".openwx", "examples", "assistant.runtime.json");
}

export async function loadAssistantProfile(
  configPath = resolveDefaultAssistantConfigPath()
): Promise<AssistantProfile | null> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const provider = normalizeProvider(parsed.provider);
    if (!provider) {
      return null;
    }

    return {
      provider,
      ...(typeof parsed.openRouterApiKey === "string"
        ? { openRouterApiKey: parsed.openRouterApiKey }
        : {}),
      ...(typeof parsed.openRouterModel === "string"
        ? { openRouterModel: parsed.openRouterModel }
        : {}),
      ...(typeof parsed.customEndpoint === "string"
        ? { customEndpoint: parsed.customEndpoint }
        : {})
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

export async function saveAssistantProfile(
  profile: AssistantProfile,
  configPath = resolveDefaultAssistantConfigPath()
): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(profile, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
}

export async function resolveAssistantProfile(
  options: ResolveAssistantProfileOptions = {}
): Promise<ResolvedAssistantProfile> {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? resolveDefaultAssistantConfigPath();
  const interactive = options.isInteractive ?? Boolean(defaultStdin.isTTY && defaultStdout.isTTY);
  const persisted = await loadAssistantProfile(configPath);

  const providerFromEnv = normalizeProvider(env.OPENWX_PROVIDER);
  if (providerFromEnv) {
    return resolveProfileForProvider(providerFromEnv, buildResolutionOptions({
      env,
      configPath,
      persisted,
      input: options.input,
      output: options.output,
      isInteractive: interactive,
      shouldPersist: true
    }));
  }

  if (persisted) {
    return {
      provider: persisted.provider,
      ...(persisted.openRouterApiKey ? { openRouterApiKey: persisted.openRouterApiKey } : {}),
      openRouterModel: persisted.openRouterModel || env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL,
      ...(persisted.customEndpoint ? { customEndpoint: persisted.customEndpoint } : {}),
      configPath
    };
  }

  if (!interactive) {
    throw new Error(
      "Assistant setup requires interaction on first run. Re-run in a TTY or set OPENWX_PROVIDER."
    );
  }

  const provider = await promptForProvider({
    ...(options.input !== undefined ? { input: options.input } : {}),
    ...(options.output !== undefined ? { output: options.output } : {})
  });

  return resolveProfileForProvider(provider, buildResolutionOptions({
    env,
    configPath,
    persisted,
    input: options.input,
    output: options.output,
    isInteractive: interactive,
    shouldPersist: true
  }));
}

async function resolveProfileForProvider(
  provider: AssistantProvider,
  options: {
    readonly env: NodeJS.ProcessEnv;
    readonly configPath: string;
    readonly persisted: AssistantProfile | null;
    readonly input?: NodeJS.ReadableStream;
    readonly output?: NodeJS.WritableStream;
    readonly isInteractive: boolean;
    readonly shouldPersist: boolean;
  }
): Promise<ResolvedAssistantProfile> {
  const openRouterModel =
    options.env.OPENROUTER_MODEL?.trim() ||
    options.persisted?.openRouterModel ||
    DEFAULT_OPENROUTER_MODEL;

  const profile: {
    provider: AssistantProvider;
    openRouterApiKey?: string;
    openRouterModel?: string;
    customEndpoint?: string;
  } = { provider };

  if (provider === "openrouter" || provider === "multi-app") {
    const apiKey =
      options.env.OPENROUTER_API_KEY?.trim() ||
      options.persisted?.openRouterApiKey?.trim() ||
      (provider === "openrouter"
        ? await promptForRequiredOpenRouterKey(options)
        : await promptForOptionalOpenRouterKey(options));

    if (apiKey) {
      profile.openRouterApiKey = apiKey;
      profile.openRouterModel = openRouterModel;
    }
  }

  if (provider === "custom-chatbot") {
    const endpoint =
      options.env.CUSTOM_CHATBOT_ENDPOINT?.trim() ||
      options.persisted?.customEndpoint?.trim() ||
      (await promptForRequiredEndpoint(options));

    profile.customEndpoint = endpoint;
  }

  if (options.shouldPersist) {
    await saveAssistantProfile(profile, options.configPath);
  }

  return {
    provider,
    ...(profile.openRouterApiKey ? { openRouterApiKey: profile.openRouterApiKey } : {}),
    openRouterModel,
    ...(profile.customEndpoint ? { customEndpoint: profile.customEndpoint } : {}),
    configPath: options.configPath
  };
}

async function promptForProvider(options: {
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
}): Promise<AssistantProvider> {
  const rl = createPromptInterface(options);

  try {
    while (true) {
      const menu = PROVIDER_CHOICES.map((choice, index) => `${index + 1}. ${choice.label}`).join("\n");
      const answer = (await rl.question(`请选择接入方式：\n${menu}\n输入编号: `)).trim();
      const numericIndex = Number.parseInt(answer, 10);
      const selected = Number.isInteger(numericIndex)
        ? PROVIDER_CHOICES[numericIndex - 1]
        : undefined;

      if (selected) {
        return selected.id;
      }
    }
  } finally {
    rl.close();
  }
}

async function promptForRequiredOpenRouterKey(options: {
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly isInteractive: boolean;
}): Promise<string> {
  if (!options.isInteractive) {
    throw new Error("OpenRouter mode requires OPENROUTER_API_KEY on non-interactive startup.");
  }

  const rl = createPromptInterface(options);

  try {
    while (true) {
      const answer = (await rl.question("请输入 OpenRouter API Key: ")).trim();
      if (answer) {
        return answer;
      }
    }
  } finally {
    rl.close();
  }
}

async function promptForOptionalOpenRouterKey(options: {
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly isInteractive: boolean;
}): Promise<string | undefined> {
  if (!options.isInteractive) {
    return undefined;
  }

  const rl = createPromptInterface(options);

  try {
    const answer = (await rl.question(
      "可选：输入 OpenRouter API Key 以启用 /router（直接回车可跳过）: "
    )).trim();
    return answer || undefined;
  } finally {
    rl.close();
  }
}

async function promptForRequiredEndpoint(options: {
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly isInteractive: boolean;
}): Promise<string> {
  if (!options.isInteractive) {
    throw new Error(
      "Custom chatbot mode requires CUSTOM_CHATBOT_ENDPOINT on non-interactive startup."
    );
  }

  const rl = createPromptInterface(options);

  try {
    while (true) {
      const answer = (await rl.question(
        "请输入自定义 chatbot 的 HTTP endpoint（例如 https://example.com/agent）: "
      )).trim();

      if (answer) {
        return answer.replace(/\/+$/, "");
      }
    }
  } finally {
    rl.close();
  }
}

function createPromptInterface(options: {
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
}) {
  return readline.createInterface({
    input: options.input ?? defaultStdin,
    output: options.output ?? defaultStdout
  });
}

function buildResolutionOptions(options: {
  readonly env: NodeJS.ProcessEnv;
  readonly configPath: string;
  readonly persisted: AssistantProfile | null;
  readonly input: NodeJS.ReadableStream | undefined;
  readonly output: NodeJS.WritableStream | undefined;
  readonly isInteractive: boolean;
  readonly shouldPersist: boolean;
}): {
  readonly env: NodeJS.ProcessEnv;
  readonly configPath: string;
  readonly persisted: AssistantProfile | null;
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly isInteractive: boolean;
  readonly shouldPersist: boolean;
} {
  return {
    env: options.env,
    configPath: options.configPath,
    persisted: options.persisted,
    ...(options.input !== undefined ? { input: options.input } : {}),
    ...(options.output !== undefined ? { output: options.output } : {}),
    isInteractive: options.isInteractive,
    shouldPersist: options.shouldPersist
  };
}

function normalizeProvider(value: unknown): AssistantProvider | undefined {
  switch (value) {
    case "claude":
    case "claude-code":
      return "claude-code";
    case "codex":
      return "codex";
    case "openrouter":
      return "openrouter";
    case "custom":
    case "custom-chatbot":
      return "custom-chatbot";
    case "multi":
    case "multi-app":
      return "multi-app";
    default:
      return undefined;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
