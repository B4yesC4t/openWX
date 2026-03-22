import { describe, expect, it } from "vitest";

import { MessageItemType, MessageState, MessageType, TypingStatus } from "../src/types.js";
import {
  buildFileMessageItem,
  buildGetConfigRequest,
  buildImageMessageItem,
  buildOutboundItem,
  buildSendMessageRequest,
  buildSendTypingRequest,
  buildVideoMessageItem,
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

  it("builds image, video, and file media items", () => {
    const media = {
      encrypt_query_param: "download-token",
      aes_key: "aes-key",
      encrypt_type: 1,
      file_size: 1234
    };

    expect(
      buildImageMessageItem({
        media,
        encryptedFileSize: 1248,
        fileSize: 1234,
        width: 640,
        height: 480
      })
    ).toStrictEqual({
      type: MessageItemType.IMAGE,
      image_item: {
        media,
        thumb_media: media,
        mid_size: 1248,
        thumb_size: 1248,
        thumb_width: 640,
        thumb_height: 480,
        hd_size: 1234
      }
    });

    expect(
      buildVideoMessageItem({
        media,
        fileSize: 555,
        durationMs: 4200
      })
    ).toStrictEqual({
      type: MessageItemType.VIDEO,
      video_item: {
        media,
        video_size: 555,
        play_length: 4200
      }
    });

    expect(
      buildFileMessageItem({
        media,
        fileName: "report.pdf",
        fileSize: 321,
        md5: "abc123"
      })
    ).toStrictEqual({
      type: MessageItemType.FILE,
      file_item: {
        media,
        file_name: "report.pdf",
        len: "321",
        md5: "abc123"
      }
    });
  });
});
