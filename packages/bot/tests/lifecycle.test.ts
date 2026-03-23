import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { MessageItemType } from "@openwx/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBot } from "../src/create-bot.js";
import {
  FakeClient,
  FakeSignalProcess,
  createImageInboundFixture,
  createTextInboundMessage,
  flushAsyncWork
} from "./test-helpers.js";

type FetchInput = Parameters<typeof fetch>[0];

describe("bot lifecycle", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts, routes commands, falls back to onMessage, and stops cleanly", async () => {
    const client = new FakeClient("bot-token");
    const ready = vi.fn();
    const stopped = vi.fn();
    const bot = createBot(
      {
        commands: {
          "/help": async (ctx) => {
            await ctx.reply("帮助信息");
          }
        },
        onMessage: async (ctx) => `echo:${ctx.text}`
      },
      {
        clientFactory: () => client,
        handleProcessSignals: false
      }
    );
    bot.on("ready", ready);
    bot.on("stopped", stopped);

    await bot.start();
    expect(bot.state).toBe("running");
    expect(client.loginCalls).toBe(0);
    expect(client.startPollingCalls).toBe(1);
    expect(ready).toHaveBeenCalledTimes(1);

    client.emitMessage(createTextInboundMessage("/help"));
    await flushAsyncWork();
    client.emitMessage(createTextInboundMessage("/unknown"));
    await flushAsyncWork();

    expect(client.sendTextCalls).toStrictEqual([
      {
        to: "user-1@im.wechat",
        text: "帮助信息"
      },
      {
        to: "user-1@im.wechat",
        text: "echo:/unknown"
      }
    ]);

    await bot.stop();
    expect(bot.state).toBe("stopped");
    expect(client.disposeCalls).toBe(1);
    expect(stopped).toHaveBeenCalledTimes(1);
  });

  it("logs in when no token is available and restore misses", async () => {
    const client = new FakeClient("");
    const bot = createBot(
      {
        onMessage: async () => undefined
      },
      {
        clientFactory: () => client,
        handleProcessSignals: false
      }
    );

    await bot.start();

    expect(client.restoreCalls).toBe(1);
    expect(client.loginCalls).toBe(1);

    await bot.stop();
  });

  it("isolates handler failures so later messages still complete", async () => {
    const client = new FakeClient("bot-token");
    const onError = vi.fn();
    const bot = createBot(
      {
        onMessage: async (ctx) => {
          if (ctx.text === "boom") {
            throw new Error("handler failed");
          }

          return "ok";
        },
        onError
      },
      {
        clientFactory: () => client,
        handleProcessSignals: false
      }
    );

    await bot.start();
    client.emitMessage(createTextInboundMessage("boom"));
    client.emitMessage(createTextInboundMessage("safe"));
    await flushAsyncWork();

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toMatchObject({
      message: "handler failed"
    });
    expect(client.sendTextCalls).toStrictEqual([
      {
        to: "user-1@im.wechat",
        text: "ok"
      }
    ]);

    await bot.stop();
  });

  it("sends typing before handling and cancels it after replying when autoTyping is enabled", async () => {
    const client = new FakeClient("bot-token");
    let resolveReply: ((value: string) => void) | undefined;
    const bot = createBot(
      {
        autoTyping: true,
        onMessage: async () =>
          await new Promise<string>((resolve) => {
            resolveReply = resolve;
          })
      },
      {
        clientFactory: () => client,
        handleProcessSignals: false
      }
    );

    await bot.start();
    client.emitMessage(createTextInboundMessage("slow"));
    await flushAsyncWork();

    expect(client.sendTypingCalls).toStrictEqual(["user-1@im.wechat"]);
    expect(client.cancelTypingCalls).toStrictEqual([]);
    expect(client.sendTextCalls).toStrictEqual([]);

    resolveReply?.("done");
    await flushAsyncWork();

    expect(client.sendTextCalls).toStrictEqual([
      {
        to: "user-1@im.wechat",
        text: "done"
      }
    ]);
    expect(client.cancelTypingCalls).toStrictEqual(["user-1@im.wechat"]);

    await bot.stop();
  });

  it("emits reconnecting when the underlying session expires", async () => {
    const client = new FakeClient("bot-token");
    client.options.sessionGuard = {
      getRemainingMs: () => 12_345
    };
    const reconnecting = vi.fn();
    const bot = createBot(
      {
        onMessage: async () => undefined
      },
      {
        clientFactory: () => client,
        handleProcessSignals: false
      }
    );
    bot.on("reconnecting", reconnecting);

    await bot.start();
    client.emitSessionExpired("bot-account");

    expect(reconnecting).toHaveBeenCalledWith({
      accountId: "bot-account",
      waitMs: 12_345
    });

    await bot.stop();
  });

  it("handles SIGINT by stopping the bot gracefully", async () => {
    const client = new FakeClient("bot-token");
    const processRef = new FakeSignalProcess();
    const bot = createBot(
      {
        onMessage: async () => undefined
      },
      {
        clientFactory: () => client,
        process: processRef
      }
    );

    await bot.start();
    processRef.emit("SIGINT");
    await flushAsyncWork();

    expect(bot.state).toBe("stopped");
    expect(client.disposeCalls).toBe(1);
  });

  it("auto-downloads inbound media and exposes the local file path", async () => {
    const client = new FakeClient("bot-token");
    const fixture = createImageInboundFixture(Buffer.from("test-image"));
    let downloadedContents = "";
    const onMessage = vi.fn(async (ctx) => {
      downloadedContents = await readFile(ctx.media?.filePath ?? "", "utf8");
    });
    const fetchMock = vi.fn(async (input: FetchInput) => {
      expect(String(input)).toContain("/download?");
      return new Response(fixture.encrypted, {
        status: 200
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const bot = createBot(
      {
        onMessage,
        autoDownloadMedia: true
      },
      {
        clientFactory: () => client,
        handleProcessSignals: false
      }
    );

    await bot.start();
    client.emitMessage(fixture.message);
    await bot.stop();

    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage.mock.calls[0]?.[0].media?.filePath).toBeTruthy();
    expect(downloadedContents).toBe("test-image");
  });

  it("uploads media for replyImage and sends the resulting image item", async () => {
    const client = new FakeClient("bot-token");
    client.apiFetchHandler = async (endpoint) => {
      if (endpoint === "getuploadurl") {
        return {
          upload_param: "upload-param"
        };
      }

      return {};
    };

    const tempFilePath = path.join(os.tmpdir(), `openwx-bot-image-${Date.now()}.txt`);
    await writeFile(tempFilePath, "image-bytes");

    const fetchMock = vi.fn(async (input: FetchInput, init?: RequestInit) => {
      expect(String(input)).toContain("/upload?");
      expect(init?.method).toBe("POST");
      return new Response(null, {
        status: 200,
        headers: {
          "x-encrypted-param": "download-param"
        }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const bot = createBot(
      {
        onMessage: async (ctx) => {
          await ctx.replyImage(tempFilePath);
        }
      },
      {
        clientFactory: () => client,
        handleProcessSignals: false
      }
    );

    await bot.start();
    client.emitMessage(createTextInboundMessage("image"));
    await bot.stop();

    expect(client.apiFetchCalls[0]?.endpoint).toBe("getuploadurl");
    expect(client.sendCalls).toHaveLength(1);
    expect(client.sendCalls[0]).toMatchObject({
      to: "user-1@im.wechat",
      message: {
        item: {
          type: MessageItemType.IMAGE,
          image_item: {
            media: {
              encrypt_query_param: "download-param"
            }
          }
        }
      }
    });
  });
});
