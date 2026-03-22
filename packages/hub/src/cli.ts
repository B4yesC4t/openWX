#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

import type { Bot, CreateBotOptions, MessageContext } from "@openwx/bot";
import type { Connector, ConnectorResponse } from "@openwx/core";

import { loadHubConfig, type HubConfig, type HubRouteConfig } from "./config.js";
import { createRouter, type HubRouteMessage, type HubRouterLogger } from "./router.js";

type ConnectorWithLifecycle = Connector & {
  init?(): Promise<void>;
  dispose?(): void;
};

type ConnectorFactory = (config?: Record<string, unknown>) => ConnectorWithLifecycle;
type ConnectorModule = Record<string, unknown>;

export interface HubCliOptions {
  readonly configPath?: string;
  readonly login: boolean;
}

export interface HubCliDependencies {
  readonly loadConfig?: typeof loadHubConfig;
  readonly loadConnector?: (
    handlerName: string,
    config: Record<string, unknown> | undefined
  ) => Promise<ConnectorWithLifecycle>;
  readonly botFactory?: (options: CreateBotOptions) => Bot | Promise<Bot>;
  readonly clientFactory?: (
    config: HubConfig
  ) => { login(): Promise<unknown>; dispose(): void } | Promise<{ login(): Promise<unknown>; dispose(): void }>;
  readonly logger?: Pick<Console, "info" | "warn" | "error">;
}

export interface HubRuntime {
  readonly config: HubConfig;
  readonly bot: Bot;
  readonly router: ReturnType<typeof createRouter>;
  readonly connectors: ReadonlyMap<number, ConnectorWithLifecycle>;
}

export function parseCliArgs(argv: readonly string[]): HubCliOptions {
  let configPath: string | undefined;
  let login = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === "--config") {
      const value = argv[index + 1];
      if (!value) {
        throw new Error("--config requires a file path.");
      }

      configPath = value;
      index += 1;
      continue;
    }

    if (argument === "--login") {
      login = true;
      continue;
    }

    throw new Error(`Unknown argument "${argument}".`);
  }

  if (!login && !configPath) {
    throw new Error("Usage: openwx-hub --config <path> | --login [--config <path>]");
  }

  return {
    ...(configPath !== undefined ? { configPath } : {}),
    login
  };
}

export async function createHubRuntime(
  config: HubConfig,
  dependencies: HubCliDependencies = {}
): Promise<HubRuntime> {
  const logger = dependencies.logger ?? console;
  const router = createRouter(config, {
    logger: toRouterLogger(logger)
  });
  const loadConnector = dependencies.loadConnector ?? loadConnectorFromModule;
  const connectors = await loadRouteConnectors(config.routes, loadConnector);
  const onMessage = createHubMessageHandler(router, connectors);
  const botFactory = dependencies.botFactory ?? createBotWithRuntimeImport;

  const bot = await botFactory({
    ...(config.auth?.token !== undefined ? { token: config.auth.token } : {}),
    ...(config.auth?.accountId !== undefined ? { accountId: config.auth.accountId } : {}),
    ...(config.auth?.storeDir !== undefined ? { storeDir: config.auth.storeDir } : {}),
    autoDownloadMedia: config.auth?.autoDownloadMedia ?? false,
    onMessage
  });

  return {
    config,
    bot,
    router,
    connectors
  };
}

export function createHubMessageHandler(
  router: ReturnType<typeof createRouter>,
  connectors: ReadonlyMap<number, ConnectorWithLifecycle>
): (ctx: MessageContext) => Promise<void> {
  return async (ctx: MessageContext): Promise<void> => {
    const request = buildRouteMessage(ctx);
    const match = router.resolve(request);
    if (!match) {
      return;
    }

    const connector = connectors.get(match.routeIndex);
    if (!connector) {
      throw new Error(`No connector loaded for route #${match.routeIndex + 1}.`);
    }

    const response = await connector.handle(match.request);
    await dispatchConnectorResponse(ctx, response);
  };
}

export async function runCli(
  argv: readonly string[],
  dependencies: HubCliDependencies = {}
): Promise<number> {
  const options = parseCliArgs(argv);
  const logger = dependencies.logger ?? console;
  const loadConfig = dependencies.loadConfig ?? loadHubConfig;

  if (options.login) {
    const config =
      options.configPath !== undefined ? await loadConfig(path.resolve(options.configPath)) : { routes: [] };
    const clientFactory =
      dependencies.clientFactory ?? ((resolvedConfig: HubConfig) => createClientForLogin(resolvedConfig));
    const client = await clientFactory(config);
    await client.login();
    client.dispose();
    logger.info("Hub login completed.");
    return 0;
  }

  const configPath = options.configPath;
  if (!configPath) {
    throw new Error("--config requires a file path.");
  }

  const config = await loadConfig(path.resolve(configPath));
  const runtime = await createHubRuntime(config, dependencies);
  await runtime.bot.start();
  logger.info("Hub started with %d routes.", runtime.router.routeCount);
  return 0;
}

export async function loadConnectorFromModule(
  handlerName: string,
  config: Record<string, unknown> | undefined,
  moduleLoader: (specifier: string) => Promise<ConnectorModule> = defaultModuleLoader
): Promise<ConnectorWithLifecycle> {
  const module = await moduleLoader(`@openwx/connector-${handlerName}`);
  const factory = resolveConnectorFactory(handlerName, module);
  const connector = factory(config);
  await connector.init?.();
  return connector;
}

export function resolveConnectorFactory(
  handlerName: string,
  module: ConnectorModule
): ConnectorFactory {
  const expectedName = `create${toPascalCase(handlerName)}Connector`;
  const expectedFactory = module[expectedName];

  if (typeof expectedFactory === "function") {
    return expectedFactory as ConnectorFactory;
  }

  const factories = Object.entries(module).filter(
    ([exportName, value]) => /^create.+Connector$/.test(exportName) && typeof value === "function"
  );

  if (factories.length === 1) {
    const factory = factories[0];
    if (!factory) {
      throw new Error(`Connector module for "${handlerName}" did not expose a usable factory.`);
    }

    return factory[1] as ConnectorFactory;
  }

  throw new Error(
    `Connector module for "${handlerName}" does not export ${expectedName}().`
  );
}

async function loadRouteConnectors(
  routes: readonly HubRouteConfig[],
  loadConnector: (
    handlerName: string,
    config: Record<string, unknown> | undefined
  ) => Promise<ConnectorWithLifecycle>
): Promise<ReadonlyMap<number, ConnectorWithLifecycle>> {
  const connectors = new Map<number, ConnectorWithLifecycle>();

  for (const [index, route] of routes.entries()) {
    connectors.set(index, await loadConnector(route.handler, route.config));
  }

  return connectors;
}

function buildRouteMessage(ctx: MessageContext): HubRouteMessage {
  return {
    userId: ctx.userId,
    ...(ctx.text !== undefined ? { text: ctx.text } : {}),
    conversationId: ctx.userId,
    ...(ctx.media?.filePath
      ? {
          media: {
            type: ctx.media.type,
            filePath: ctx.media.filePath,
            mimeType: ctx.media.mimeType
          }
        }
      : {})
  };
}

async function dispatchConnectorResponse(
  ctx: MessageContext,
  response: ConnectorResponse
): Promise<void> {
  if (response.text) {
    await ctx.reply(response.text);
  }
}

async function createBotWithRuntimeImport(options: CreateBotOptions): Promise<Bot> {
  const { createBot } = await import("@openwx/bot");
  return createBot(options);
}

async function createClientForLogin(
  config: HubConfig
): Promise<{ login(): Promise<unknown>; dispose(): void }> {
  const { ILinkClient } = await import("@openwx/core");
  return new ILinkClient({
    ...(config.auth?.token !== undefined ? { token: config.auth.token } : {}),
    ...(config.auth?.accountId !== undefined ? { accountId: config.auth.accountId } : {}),
    ...(config.auth?.storeDir !== undefined ? { storeDir: config.auth.storeDir } : {})
  });
}

function toPascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment[0]!.toUpperCase() + segment.slice(1))
    .join("");
}

function toRouterLogger(logger: Pick<Console, "warn">): HubRouterLogger {
  return {
    warn(message: string) {
      logger.warn(message);
    }
  };
}

async function defaultModuleLoader(specifier: string): Promise<ConnectorModule> {
  return import(specifier);
}

function isCliEntryPoint(metaUrl: string): boolean {
  const argvPath = process.argv[1];
  if (!argvPath) {
    return false;
  }

  return pathToFileURL(argvPath).href === metaUrl;
}

if (isCliEntryPoint(import.meta.url)) {
  void runCli(process.argv.slice(2)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
