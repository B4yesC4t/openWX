import { createServer } from "node:http";

import nock from "nock";
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";

import {
  ILinkClient,
  ILINK_BOT_TYPE,
  randomWechatUin,
  SESSION_EXPIRED_ERRCODE
} from "../src/client.js";
import { MessageItemType, MessageState, MessageType } from "../src/types.js";

describe("ILinkClient", () => {
  beforeAll(() => {
    nock.disableNetConnect();
    nock.enableNetConnect((host) => host.startsWith("127.0.0.1") || host.startsWith("localhost"));
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("uses protocol defaults in the scaffold metadata", () => {
    const client = new ILinkClient();

    expect(client.describe().notes).toContain(
      "Default API base: https://ilinkai.weixin.qq.com"
    );
    expect(client.options.cdnBaseUrl).toBe("https://novac2c.cdn.weixin.qq.com/c2c");
  });

  it("generates X-WECHAT-UIN from the decimal uint32 string", () => {
    const uin = randomWechatUin();
    const decoded = Buffer.from(uin, "base64").toString("utf8");
    const parsed = Number(decoded);

    expect(/^\d+$/.test(decoded)).toBe(true);
    expect(Number.isInteger(parsed)).toBe(true);
    expect(parsed).toBeGreaterThanOrEqual(0);
    expect(parsed).toBeLessThanOrEqual(0xffff_ffff);
  });

  it("apiFetch sends auth headers and appends protocol base_info", async () => {
    const client = new ILinkClient({
      token: "bot-token",
      skRouteTag: "route-a"
    });
    const ready = vi.fn();
    client.on("ready", ready);

    const scope = nock("https://ilinkai.weixin.qq.com")
      .matchHeader("authorizationtype", "ilink_bot_token")
      .matchHeader("authorization", "Bearer bot-token")
      .matchHeader("skroutetag", "route-a")
      .matchHeader("x-wechat-uin", (value) => {
        const header = Array.isArray(value) ? value[0] : value;
        const decoded = Buffer.from(String(header), "base64").toString("utf8");
        return /^\d+$/.test(decoded);
      })
      .post("/ilink/bot/getconfig", (body) => {
        expect(body).toMatchObject({
          ilink_user_id: "user@im.wechat",
          context_token: "ctx-123",
          base_info: {
            bot_type: ILINK_BOT_TYPE,
            channel_version: "1.0.0"
          }
        });
        return true;
      })
      .reply(200, {
        ret: 0,
        typing_ticket: "typing-ticket"
      });

    const response = await client.apiFetch("getconfig", {
      ilink_user_id: "user@im.wechat",
      context_token: "ctx-123"
    });

    expect(response).toStrictEqual({
      ret: 0,
      typing_ticket: "typing-ticket"
    });
    expect(ready).toHaveBeenCalledTimes(1);
    expect(scope.isDone()).toBe(true);
  });

  it("uses AbortController timeouts for light requests", async () => {
    const requestTimeoutMs = 50;
    const server = createServer((_request, response) => {
      setTimeout(() => {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ ret: 0 }));
      }, requestTimeoutMs + 100);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : 0;
    const client = new ILinkClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token: "bot-token"
    });
    const errors: Error[] = [];
    client.on("error", (error) => {
      errors.push(error);
    });
    try {
      await expect(
        client.apiFetch(
          "getconfig",
          {
            ilink_user_id: "user@im.wechat",
            context_token: "ctx-timeout"
          },
          {
            requestKind: "light",
            timeoutMs: requestTimeoutMs
          }
        )
      ).rejects.toMatchObject({
        name: "AbortError"
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]?.name).toBe("AbortError");
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  });

  it("poll stores context_token, emits message, and sendText echoes it back", async () => {
    const client = new ILinkClient({
      token: "bot-token"
    });
    const messages = vi.fn();
    client.on("message", messages);

    const incomingMessage = {
      from_user_id: "user-1@im.wechat",
      to_user_id: "bot@im.bot",
      message_type: MessageType.USER,
      message_state: MessageState.FINISH,
      context_token: "ctx-abc",
      item_list: [
        {
          type: MessageItemType.TEXT,
          text_item: {
            text: "hello"
          }
        }
      ]
    };

    nock("https://ilinkai.weixin.qq.com")
      .post("/ilink/bot/getupdates", (body) => {
        expect(body).toMatchObject({
          get_updates_buf: "cursor-1",
          timeout: 35_000,
          base_info: {
            bot_type: ILINK_BOT_TYPE
          }
        });
        return true;
      })
      .reply(200, {
        ret: 0,
        msgs: [incomingMessage],
        get_updates_buf: "cursor-2",
        longpolling_timeout_ms: 35_000
      });

    let outboundBody: unknown;
    const sendScope = nock("https://ilinkai.weixin.qq.com")
      .post("/ilink/bot/sendmessage", (body) => {
        outboundBody = body;
        return true;
      })
      .reply(200, {
        ret: 0
      });

    const pollResult = await client.poll({
      getUpdatesBuf: "cursor-1"
    });
    await client.sendText("user-1@im.wechat", "reply text", "client-123");

    expect(pollResult).toStrictEqual({
      messages: [
        {
          raw: incomingMessage,
          fromUserId: "user-1@im.wechat",
          toUserId: "bot@im.bot",
          contextToken: "ctx-abc",
          itemList: incomingMessage.item_list,
          primaryItem: incomingMessage.item_list[0],
          primaryItemKind: "text",
          text: "hello"
        }
      ],
      rawMessages: [incomingMessage],
      getUpdatesBuf: "cursor-2",
      longPollingTimeoutMs: 35_000,
      sessionExpired: false
    });
    expect(messages).toHaveBeenCalledWith({
      raw: incomingMessage,
      fromUserId: "user-1@im.wechat",
      toUserId: "bot@im.bot",
      contextToken: "ctx-abc",
      itemList: incomingMessage.item_list,
      primaryItem: incomingMessage.item_list[0],
      primaryItemKind: "text",
      text: "hello"
    });
    expect(outboundBody).toMatchObject({
      msg: {
        from_user_id: "",
        to_user_id: "user-1@im.wechat",
        client_id: "client-123",
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        context_token: "ctx-abc",
        item_list: [
          {
            type: MessageItemType.TEXT,
            text_item: {
              text: "reply text"
            }
          }
        ]
      },
      base_info: {
        bot_type: ILINK_BOT_TYPE
      }
    });
    expect(sendScope.isDone()).toBe(true);
  });

  it("sendText rejects when no context_token has been cached", async () => {
    const client = new ILinkClient({
      token: "bot-token"
    });

    await expect(client.sendText("missing@im.wechat", "reply")).rejects.toThrow(
      "No context_token for user missing@im.wechat. Cannot send without receiving a message first."
    );
  });

  it("poll flags session expiry and emits sessionExpired", async () => {
    const client = new ILinkClient({
      token: "bot-token"
    });
    const onSessionExpired = vi.fn();
    client.on("sessionExpired", onSessionExpired);

    nock("https://ilinkai.weixin.qq.com")
      .post("/ilink/bot/getupdates")
      .reply(200, {
        ret: -1,
        errcode: SESSION_EXPIRED_ERRCODE,
        errmsg: "session expired",
        get_updates_buf: "cursor-expired"
      });

    const result = await client.poll();

    expect(result).toStrictEqual({
      messages: [],
      rawMessages: [],
      getUpdatesBuf: "cursor-expired",
      sessionExpired: true
    });
    expect(onSessionExpired).toHaveBeenCalledWith("default");
  });

  it("poll parses text quotes and prioritizes media items", async () => {
    const client = new ILinkClient({
      token: "bot-token"
    });

    const incomingMessage = {
      from_user_id: "user-2@im.wechat",
      context_token: "ctx-media",
      item_list: [
        {
          type: MessageItemType.TEXT,
          text_item: {
            text: "正文"
          },
          ref_msg: {
            title: "引用摘要",
            message_item: {
              type: MessageItemType.TEXT,
              text_item: {
                text: "被引用内容"
              }
            }
          }
        },
        {
          type: MessageItemType.IMAGE,
          image_item: {
            url: "https://example.com/image.jpg"
          }
        }
      ]
    };

    nock("https://ilinkai.weixin.qq.com")
      .post("/ilink/bot/getupdates")
      .reply(200, {
        ret: 0,
        msgs: [incomingMessage],
        get_updates_buf: "cursor-media"
      });

    const result = await client.poll();

    expect(result.messages[0]).toMatchObject({
      fromUserId: "user-2@im.wechat",
      contextToken: "ctx-media",
      primaryItemKind: "image",
      text: "[引用: 引用摘要 | 被引用内容]\n正文"
    });
  });

  it("dispose emits stopped exactly once", () => {
    const client = new ILinkClient({
      token: "bot-token"
    });
    const stopped = vi.fn();
    client.on("stopped", stopped);

    client.dispose();
    client.dispose();

    expect(stopped).toHaveBeenCalledTimes(1);
  });
});
