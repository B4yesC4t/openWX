import { describe, expect, it } from "vitest";

import { MessageItemType, MessageState, MessageType, TypingStatus } from "../src/types.js";
import {
  buildGetConfigRequest,
  buildOutboundItem,
  buildSendMessageRequest,
  buildSendTypingRequest,
  createSendScaffold
} from "../src/send.js";

describe("send helpers", () => {
  it("reports the protocol send scaffold defaults", () => {
    expect(createSendScaffold()).toMatchObject({
      packageName: "@openwx/core",
      maxItemsPerMessage: 1
    });
    expect(createSendScaffold().notes).toContain(
      "Typing tickets are fetched via getconfig and cached per user."
    );
  });

  it("builds sendmessage payloads with context_token and quoted replies", () => {
    expect(
      buildSendMessageRequest({
        to: "user@im.wechat",
        contextToken: "ctx-123",
        message: {
          text: "reply text",
          clientId: "generated-client-id",
          replyTo: 42
        }
      })
    ).toStrictEqual({
      msg: {
        from_user_id: "",
        to_user_id: "user@im.wechat",
        client_id: "generated-client-id",
        message_type: MessageType.BOT,
        message_state: MessageState.FINISH,
        context_token: "ctx-123",
        quoted_msg: {
          message_id: 42
        },
        item_list: [
          {
            type: MessageItemType.TEXT,
            text_item: {
              text: "reply text"
            }
          }
        ]
      }
    });
  });

  it("normalizes outbound items and rejects invalid payloads", () => {
    expect(
      buildOutboundItem({
        item: {
          image_item: {
            url: "https://example.com/image.jpg"
          }
        }
      })
    ).toStrictEqual({
      type: MessageItemType.IMAGE,
      image_item: {
        url: "https://example.com/image.jpg"
      }
    });

    expect(() => buildOutboundItem({ text: "x", item: { type: MessageItemType.TEXT } })).toThrow(
      "OutboundMessage cannot provide both text and item."
    );
    expect(() => buildOutboundItem({})).toThrow(
      "OutboundMessage requires either text or item."
    );
  });

  it("builds getconfig and sendtyping requests", () => {
    expect(buildGetConfigRequest("user@im.wechat", "ctx-abc")).toStrictEqual({
      ilink_user_id: "user@im.wechat",
      context_token: "ctx-abc"
    });

    expect(buildSendTypingRequest("user@im.wechat", "ticket-1", "typing")).toStrictEqual({
      ilink_user_id: "user@im.wechat",
      typing_ticket: "ticket-1",
      status: TypingStatus.TYPING
    });

    expect(buildSendTypingRequest("user@im.wechat", "ticket-1", "cancel")).toStrictEqual({
      ilink_user_id: "user@im.wechat",
      typing_ticket: "ticket-1",
      status: TypingStatus.CANCEL
    });
  });
});
