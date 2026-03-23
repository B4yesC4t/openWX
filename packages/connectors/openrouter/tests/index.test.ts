import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MessageContext, MessageMedia } from "@openwx/bot";

describe("createHandler", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("OPENROUTER_API_KEY", "or-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("sends chat completions to OpenRouter and returns the text reply", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: "代理回复"
            }
          }
        ]
      })
    );

    const { createHandler } = await import("../src/index.js");
    const handler = createHandler({
      model: "openai/gpt-5.2",
      siteName: "openWX",
      siteUrl: "https://example.com"
    });

    await expect(
      handler(
        createContext({
          userId: "user_xxx",
          text: "用户消息"
        })
      )
    ).resolves.toBe("代理回复");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.headers).toMatchObject({
      authorization: "Bearer or-key",
      "content-type": "application/json",
      "http-referer": "https://example.com",
      "x-openrouter-title": "openWX"
    });
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "openai/gpt-5.2",
      stream: false
    });
  });

  it("includes image payloads in the user message summary", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: "收到"
            }
          }
        ]
      })
    );

    const { createHandler } = await import("../src/index.js");
    const handler = createHandler();

    await handler(
      createContext({
        text: "分析一下",
        media: createMedia("image", Buffer.from("img"), "image/png")
      })
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body)).messages.at(-1).content).toContain(
      "data:image/png;base64,aW1n"
    );
  });

  it("exposes a connector factory compatible with hub runtime", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        choices: [
          {
            message: {
              content: "连接器回复"
            }
          }
        ]
      })
    );

    const { createOpenRouterConnector } = await import("../src/index.js");
    const connector = createOpenRouterConnector({
      model: "openai/gpt-5.2"
    });

    await expect(
      connector.handle({
        conversationId: "conversation-a",
        text: "请总结一下"
      })
    ).resolves.toStrictEqual({
      text: "连接器回复"
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
