import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MessageContext, MessageMedia } from "@openwx/bot";

describe("createHandler", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("forwards messages to the configured endpoint with headers", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        text: "代理回复"
      })
    );

    const { createHandler } = await import("../src/index.js");
    const handler = createHandler({
      endpoint: "https://proxy.example.com",
      headers: {
        Authorization: "Bearer token"
      }
    });

    await expect(
      handler(
        createContext({
          userId: "user_xxx",
          text: "用户消息",
          media: createMedia("image", Buffer.from("img"), "image/png")
        })
      )
    ).resolves.toBe("代理回复");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://proxy.example.com/chat");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      Authorization: "Bearer token"
    });
    expect(JSON.parse(String(init.body))).toStrictEqual({
      conversationId: "user_xxx",
      text: "用户消息",
      media: {
        type: "image",
        url: `data:image/png;base64,${Buffer.from("img").toString("base64")}`,
        mimeType: "image/png"
      }
    });
  });

  it("retries failed requests before succeeding", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("upstream failed"))
      .mockResolvedValueOnce(jsonResponse({ text: "第二次成功" }));

    const { createHandler } = await import("../src/index.js");
    const response = await createHandler({
      endpoint: "https://proxy.example.com",
      retries: 1
    })(createContext({ text: "retry me" }));

    expect(response).toBe("第二次成功");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns fallback text when requests time out", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    });

    const { FALLBACK_TEXT, createHandler } = await import("../src/index.js");
    const responsePromise = createHandler({
      endpoint: "https://proxy.example.com",
      timeout: 10,
      retries: 0
    })(createContext({ text: "timeout" }));

    await vi.advanceTimersByTimeAsync(10);

    await expect(responsePromise).resolves.toBe(FALLBACK_TEXT);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exposes a connector factory compatible with hub runtime", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "openwx-http-proxy-"));
    const filePath = path.join(tempDirectory, "input.png");
    await writeFile(filePath, Buffer.from("img"));
    fetchMock.mockResolvedValue(
      jsonResponse({
        text: "代理回复"
      })
    );

    const { createHttpProxyConnector } = await import("../src/index.js");
    const connector = createHttpProxyConnector({
      endpoint: "https://proxy.example.com",
      headers: {
        Authorization: "Bearer token"
      }
    });

    await expect(
      connector.handle({
        conversationId: "user_xxx",
        text: "用户消息",
        media: {
          type: "image",
          filePath,
          mimeType: "image/png"
        }
      })
    ).resolves.toStrictEqual({
      text: "代理回复"
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://proxy.example.com/chat");
    expect(init.headers).toMatchObject({
      "content-type": "application/json",
      Authorization: "Bearer token"
    });
    expect(JSON.parse(String(init.body))).toStrictEqual({
      conversationId: "user_xxx",
      text: "用户消息",
      media: {
        type: "image",
        url: `data:image/png;base64,${Buffer.from("img").toString("base64")}`,
        mimeType: "image/png"
      }
    });
  });
});

function createContext(overrides: Partial<MessageContext>): MessageContext {
  return {
    message: { from_user_id: "user-1@im.wechat" },
    userId: "user-1@im.wechat",
    client: {} as never,
    reply: vi.fn(async () => undefined),
    replyImage: vi.fn(async () => undefined),
    replyFile: vi.fn(async () => undefined),
    text: "",
    ...overrides
  } as MessageContext;
}

function createMedia(
  type: MessageMedia["type"],
  data: Buffer,
  mimeType: string,
  fileName?: string
): MessageMedia {
  return {
    type,
    filePath: null,
    mimeType,
    ...(fileName !== undefined ? { fileName } : {}),
    download: vi.fn(async () => data),
    save: vi.fn(async (targetPath: string) => targetPath)
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json"
    }
  });
}
