import { readFile } from "node:fs/promises";
import path from "node:path";

import safeRegex from "safe-regex";
import YAML from "yaml";

export interface HubAuthConfig {
  readonly token?: string;
  readonly accountId?: string;
  readonly storeDir?: string;
  readonly autoDownloadMedia?: boolean;
  readonly autoTyping?: boolean;
}

export interface HubRouteConfig {
  readonly handler: string;
  readonly config?: Record<string, unknown>;
  readonly prefix?: string;
  readonly keywords?: readonly string[];
  readonly users?: readonly string[];
  readonly pattern?: string;
  readonly default?: boolean;
  readonly stripPrefix?: boolean;
}

export interface HubConfig {
  readonly auth?: HubAuthConfig;
  readonly routes: readonly HubRouteConfig[];
}

export interface LoadHubConfigOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly allowedHandlers?: readonly string[];
}

interface RawHubRouteConfig {
  readonly handler?: unknown;
  readonly config?: unknown;
  readonly prefix?: unknown;
  readonly keyword?: unknown;
  readonly keywords?: unknown;
  readonly users?: unknown;
  readonly pattern?: unknown;
  readonly default?: unknown;
  readonly stripPrefix?: unknown;
}

interface RawHubConfig {
  readonly auth?: unknown;
  readonly routes?: unknown;
}

export const DEFAULT_HANDLER_NAMES = [
  "claude-code",
  "codex",
  "echo",
  "http-proxy",
  "openrouter"
] as const;

export function defineHubConfig(config: HubConfig): HubConfig {
  return validateHubConfig(config);
}

export async function loadHubConfig(
  filePath: string,
  options: LoadHubConfigOptions = {}
): Promise<HubConfig> {
  const format = detectConfigFormat(filePath);
  const rawContent = await readFile(filePath, "utf8");
  return parseHubConfig(rawContent, {
    ...options,
    format
  });
}

export function parseHubConfig(
  content: string,
  options: LoadHubConfigOptions & { readonly format: "json" | "yaml" }
): HubConfig {
  const rawConfig = parseConfigDocument(content, options.format);
  const substitutedConfig = substituteEnvironmentVariablesInValue(rawConfig, options.env ?? process.env);
  return normalizeHubConfig(substitutedConfig, options.allowedHandlers ?? DEFAULT_HANDLER_NAMES);
}

export function validateHubConfig(
  config: HubConfig,
  allowedHandlers: readonly string[] = DEFAULT_HANDLER_NAMES
): HubConfig {
  return normalizeHubConfig(config, allowedHandlers);
}

export function substituteEnvironmentVariables(
  content: string,
  env: NodeJS.ProcessEnv
): string {
  return content.replaceAll(/\$\{([A-Z0-9_]+)\}/g, (_match, variableName: string) => {
    const value = env[variableName];
    if (value === undefined) {
      throw new Error(`Missing environment variable "${variableName}".`);
    }

    return value;
  });
}

export function validateRoutePattern(pattern: string, fieldName = "pattern"): string {
  try {
    new RegExp(pattern);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid regular expression in ${fieldName}: ${message}`, {
      cause: error
    });
  }

  if (!safeRegex(pattern)) {
    throw new Error(`Unsafe regular expression in ${fieldName}: "${pattern}".`);
  }

  return pattern;
}

function detectConfigFormat(filePath: string): "json" | "yaml" {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".json") {
    return "json";
  }

  if (extension === ".yaml" || extension === ".yml") {
    return "yaml";
  }

  throw new Error(
    `Unsupported hub config format "${extension || "(none)"}". Use .json, .yaml, or .yml.`
  );
}

function parseConfigDocument(content: string, format: "json" | "yaml"): RawHubConfig {
  if (format === "json") {
    return parseJsonConfig(content);
  }

  const parsed = YAML.parse(content);
  if (!isRecord(parsed)) {
    throw new Error("Hub config must be an object.");
  }

  return parsed;
}

function parseJsonConfig(content: string): RawHubConfig {
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!isRecord(parsed)) {
      throw new Error("Hub config must be an object.");
    }

    return parsed;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to parse JSON hub config: ${message}`, {
      cause: error
    });
  }
}

function normalizeHubConfig(
  rawConfig: unknown,
  allowedHandlers: readonly string[]
): HubConfig {
  if (!isRecord(rawConfig)) {
    throw new Error("Hub config must be an object.");
  }

  if (!Array.isArray(rawConfig.routes) || rawConfig.routes.length === 0) {
    throw new Error("Hub config must define at least one route.");
  }

  const auth = normalizeAuth(rawConfig.auth);
  const routes = rawConfig.routes.map((route, index) =>
    normalizeRoute(route, index, allowedHandlers)
  );

  const defaultRoutes = routes.filter((route) => route.default);
  if (defaultRoutes.length > 1) {
    throw new Error("Hub config may define only one default route.");
  }

  return {
    ...(auth !== undefined ? { auth } : {}),
    routes
  };
}

function normalizeAuth(rawAuth: unknown): HubAuthConfig | undefined {
  if (rawAuth === undefined) {
    return undefined;
  }

  if (!isRecord(rawAuth)) {
    throw new Error("Hub auth config must be an object.");
  }

  const token = asOptionalString(rawAuth.token, "auth.token");
  const accountId = asOptionalString(rawAuth.accountId, "auth.accountId");
  const storeDir = asOptionalString(rawAuth.storeDir, "auth.storeDir");
  const auth: HubAuthConfig = {
    ...(token !== undefined ? { token } : {}),
    ...(accountId !== undefined ? { accountId } : {}),
    ...(storeDir !== undefined ? { storeDir } : {}),
    ...(rawAuth.autoDownloadMedia !== undefined
      ? { autoDownloadMedia: asBoolean(rawAuth.autoDownloadMedia, "auth.autoDownloadMedia") }
      : {}),
    ...(rawAuth.autoTyping !== undefined
      ? { autoTyping: asBoolean(rawAuth.autoTyping, "auth.autoTyping") }
      : {})
  };

  return Object.keys(auth).length > 0 ? auth : undefined;
}

function normalizeRoute(
  rawRoute: unknown,
  index: number,
  allowedHandlers: readonly string[]
): HubRouteConfig {
  if (!isRecord(rawRoute)) {
    throw new Error(`Route #${index + 1} must be an object.`);
  }

  const route = rawRoute as RawHubRouteConfig;
  const handler = asRequiredString(route.handler, `routes[${index}].handler`);
  if (!allowedHandlers.includes(handler)) {
    throw new Error(
      `Route #${index + 1} uses unsupported handler "${handler}". Allowed handlers: ${allowedHandlers.join(", ")}.`
    );
  }

  const keyword = asOptionalString(route.keyword, `routes[${index}].keyword`);
  const keywords = normalizeStringArray(route.keywords, `routes[${index}].keywords`);
  const normalizedKeywords =
    keyword !== undefined ? [keyword, ...(keywords ?? [])] : (keywords ?? undefined);
  const users = normalizeStringArray(route.users, `routes[${index}].users`);
  const prefix = asOptionalString(route.prefix, `routes[${index}].prefix`);
  const pattern = asOptionalString(route.pattern, `routes[${index}].pattern`);
  const validatedPattern =
    pattern === undefined ? undefined : validateRoutePattern(pattern, `routes[${index}].pattern`);
  const isDefault =
    route.default === undefined ? false : asBoolean(route.default, `routes[${index}].default`);

  const matcherCount = Number(prefix !== undefined) +
    Number(normalizedKeywords !== undefined) +
    Number(users !== undefined) +
    Number(validatedPattern !== undefined) +
    Number(isDefault);

  if (matcherCount === 0) {
    throw new Error(`Route #${index + 1} must define one matcher or set default: true.`);
  }

  if (matcherCount > 1) {
    throw new Error(`Route #${index + 1} must define exactly one matcher type.`);
  }

  const config = normalizeConfigObject(route.config, index);

  return {
    handler,
    ...(config !== undefined ? { config } : {}),
    ...(prefix !== undefined ? { prefix } : {}),
    ...(normalizedKeywords !== undefined ? { keywords: normalizedKeywords } : {}),
    ...(users !== undefined ? { users } : {}),
    ...(validatedPattern !== undefined ? { pattern: validatedPattern } : {}),
    ...(isDefault ? { default: true } : {}),
    ...(route.stripPrefix !== undefined
      ? { stripPrefix: asBoolean(route.stripPrefix, `routes[${index}].stripPrefix`) }
      : prefix !== undefined
        ? { stripPrefix: true }
        : {})
  };
}

function normalizeConfigObject(
  value: unknown,
  index: number
): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Route #${index + 1} config must be an object.`);
  }

  return value;
}

function normalizeStringArray(
  value: unknown,
  fieldName: string
): readonly string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array of strings.`);
  }

  return value.map((item, index) => asRequiredString(item, `${fieldName}[${index}]`));
}

function asRequiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string.`);
  }

  return value.trim();
}

function asOptionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return asRequiredString(value, fieldName);
}

function asBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean.`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function substituteEnvironmentVariablesInValue<T>(
  value: T,
  env: NodeJS.ProcessEnv
): T {
  if (typeof value === "string") {
    return substituteEnvironmentVariables(value, env) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => substituteEnvironmentVariablesInValue(item, env)) as T;
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        substituteEnvironmentVariablesInValue(entry, env)
      ])
    ) as T;
  }

  return value;
}
