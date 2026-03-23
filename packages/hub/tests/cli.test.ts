import { EventEmitter } from "node:events";

import type { Bot, CreateBotOptions, MessageContext } from "@openwx/bot";
import { describe, expect, it, vi } from "vitest";

import {
  createHubRuntime,
  loadConnectorFromModule,
  parseCliArgs,
  resolveConnectorFactory,
  runCli
} from "../src/cli.js";

function createMockBot(): Bot {
  return Object.assign(new EventEmitter(), {
    client: {} as Bot["client"],
    state: "idle" as const,
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined)
  });
}

describe("hub cli", () => {
  it("parses config and login arguments", () => {
    expect(parseCliArgs(["--config", "hub.yaml"])).toEqual({
      configPath: "hub.yaml",
      login: false
    });

    expect(parseCliArgs(["--login"])).toEqual({
      login: true
    });

    expect(() => parseCliArgs([])).toThrow(/Usage: openwx-hub/);
  });

  it("loads routes, connectors, and bot startup dependencies in order", async () => {
    const events: string[] = [];
    const reply = vi.fn(async (text: string) => {
      void text;
    });
    let capturedOnMessage: CreateBotOptions["onMessage"];
    let capturedBotOptions: CreateBotOptions | undefined;

    const runtime = await createHubRuntime(
      {
        auth: {
          token: "token-123",
          autoTyping: true
        },
        routes: [
          { prefix: "/ai", handler: "claude-code", config: { model: "sonnet" } },
          { default: true, handler: "echo" }
        ]
      },
      {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        loadConnector: async (handlerName, config) => {
          events.push(`load:${handlerName}`);
          return {
            id: handlerName,
            async handle(request) {
              events.push(`handle:${handlerName}:${request.text}`);
              return {
                text: `${handlerName}:${String(config?.model ?? request.text)}`
              };
            }
          };
        },
        botFactory: (options) => {
          events.push("createBot");
          capturedBotOptions = options;
          capturedOnMessage = options.onMessage;
          return createMockBot();
        }
      }
    );

    expect(events).toEqual(["load:claude-code", "load:echo", "createBot"]);
    expect(runtime.connectors.size).toBe(2);
    expect(capturedBotOptions?.autoTyping).toBe(true);
    expect(capturedOnMessage).toBeTypeOf("function");

    const ctx: MessageContext = {
      message: {} as MessageContext["message"],
      userId: "wechat-user",
      text: "/ai hello",
      client: {} as MessageContext["client"],
      reply,
      replyImage: vi.fn(async (path: string) => {
        void path;
      }),
      replyFile: vi.fn(async (path: string, name?: string) => {
        void path;
        void name;
      })
    };

    await capturedOnMessage?.(ctx);

    expect(reply).toHaveBeenCalledWith("claude-code:sonnet");
    expect(events).toContain("handle:claude-code:hello");
  });

  it("runs login mode without starting the bot", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    const dispose = vi.fn();
    const loadConfig = vi.fn().mockResolvedValue({
      auth: {
        token: "token-123"
      },
      routes: [{ default: true, handler: "echo" }]
    });
    const logger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    const result = await runCli(["--login", "--config", "hub.yaml"], {
      loadConfig,
      clientFactory: () => ({
        login,
        dispose
      }),
      logger,
      botFactory: vi.fn()
    });

    expect(result).toBe(0);
    expect(loadConfig).toHaveBeenCalled();
    expect(login).toHaveBeenCalledOnce();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it("resolves connector factories by conventional export name", () => {
    const factory = vi.fn();

    expect(
      resolveConnectorFactory("http-proxy", {
        createHttpProxyConnector: factory
      })
    ).toBe(factory);
  });

  it("loads the real echo connector module through the hub loader", async () => {
    const connector = await loadConnectorFromModule(
      "echo",
      undefined,
      async () => import("../../connectors/echo/src/index.js")
    );

    await expect(
      connector.handle({
        conversationId: "demo",
        text: "hello"
      })
    ).resolves.toStrictEqual({
      text: "hello"
    });
  });
});
