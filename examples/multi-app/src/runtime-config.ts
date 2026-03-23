import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as defaultStdin, stdout as defaultStdout } from "node:process";

export interface MultiAppRuntimeConfig {
  readonly openRouterApiKey?: string;
  readonly openRouterModel?: string;
}

export interface ResolvedOpenRouterSettings {
  readonly apiKey?: string;
  readonly model: string;
  readonly configPath: string;
}

export interface ResolveOpenRouterSettingsOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly configPath?: string;
  readonly input?: NodeJS.ReadableStream;
  readonly output?: NodeJS.WritableStream;
  readonly isInteractive?: boolean;
  readonly defaultModel?: string;
}

const DEFAULT_OPENROUTER_MODEL = "openai/gpt-4.1-mini";

export function resolveDefaultRuntimeConfigPath(): string {
  return path.join(os.homedir(), ".openwx", "examples", "multi-app.runtime.json");
}

export async function loadRuntimeConfig(
  configPath = resolveDefaultRuntimeConfigPath()
): Promise<MultiAppRuntimeConfig> {
  try {
    const raw = await readFile(configPath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      ...(typeof parsed.openRouterApiKey === "string"
        ? { openRouterApiKey: parsed.openRouterApiKey }
        : {}),
      ...(typeof parsed.openRouterModel === "string"
        ? { openRouterModel: parsed.openRouterModel }
        : {})
    };
  } catch (error) {
    if (isMissingFileError(error)) {
      return {};
    }

    throw error;
  }
}

export async function saveRuntimeConfig(
  config: MultiAppRuntimeConfig,
  configPath = resolveDefaultRuntimeConfigPath()
): Promise<void> {
  await persistRuntimeConfig(config, configPath);
}

export async function resolveOpenRouterSettings(
  options: ResolveOpenRouterSettingsOptions = {}
): Promise<ResolvedOpenRouterSettings> {
  const env = options.env ?? process.env;
  const configPath = options.configPath ?? resolveDefaultRuntimeConfigPath();
  const persistedConfig = await loadRuntimeConfig(configPath);

  const apiKeyFromEnv = env.OPENROUTER_API_KEY?.trim();
  const modelFromEnv = env.OPENROUTER_MODEL?.trim();

  if (apiKeyFromEnv) {
    return {
      apiKey: apiKeyFromEnv,
      model: modelFromEnv || persistedConfig.openRouterModel || options.defaultModel || DEFAULT_OPENROUTER_MODEL,
      configPath
    };
  }

  if (persistedConfig.openRouterApiKey?.trim()) {
    return {
      apiKey: persistedConfig.openRouterApiKey.trim(),
      model:
        modelFromEnv ||
        persistedConfig.openRouterModel ||
        options.defaultModel ||
        DEFAULT_OPENROUTER_MODEL,
      configPath
    };
  }

  const interactive = options.isInteractive ?? Boolean(defaultStdin.isTTY && defaultStdout.isTTY);
  if (!interactive) {
    return {
      model: modelFromEnv || persistedConfig.openRouterModel || options.defaultModel || DEFAULT_OPENROUTER_MODEL,
      configPath
    };
  }

  const rl = readline.createInterface({
    input: options.input ?? defaultStdin,
    output: options.output ?? defaultStdout
  });

  try {
    const enteredApiKey = (await rl.question(
      "可选：输入 OpenRouter API Key 以启用 /router（直接回车可跳过）: "
    )).trim();

    if (!enteredApiKey) {
      return {
        model:
          modelFromEnv || persistedConfig.openRouterModel || options.defaultModel || DEFAULT_OPENROUTER_MODEL,
        configPath
      };
    }

    const model =
      modelFromEnv || persistedConfig.openRouterModel || options.defaultModel || DEFAULT_OPENROUTER_MODEL;

    await persistRuntimeConfig(
      {
        openRouterApiKey: enteredApiKey,
        openRouterModel: model
      },
      configPath
    );

    return {
      apiKey: enteredApiKey,
      model,
      configPath
    };
  } finally {
    rl.close();
  }
}

async function persistRuntimeConfig(
  config: MultiAppRuntimeConfig,
  configPath: string
): Promise<void> {
  await mkdir(path.dirname(configPath), { recursive: true });
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
