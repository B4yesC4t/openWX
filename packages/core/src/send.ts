import * as crypto from "node:crypto";

import {
  MessageItemType,
  MessageState,
  MessageType,
  TypingStatus,
  createScaffoldModule,
  type GetConfigReq,
  type MessageItem,
  type MessageItemTypeValue,
  type OutboundMessage,
  type ScaffoldModule,
  type SendMessageReq,
  type SendTypingReq
} from "./types.js";

export interface SendScaffold {
  readonly packageName: "@openwx/core";
  readonly maxItemsPerMessage: number;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export interface BuildSendMessageRequestOptions {
  readonly to: string;
  readonly contextToken: string;
  readonly message: OutboundMessage;
}

export function createSendScaffold(maxItemsPerMessage = 1): SendScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "sendmessage requires context_token passthrough.",
    "Protocol allows one item per outbound message.",
    "Typing tickets are fetched via getconfig and cached per user."
  ]);

  return {
    packageName: "@openwx/core",
    maxItemsPerMessage,
    status: module.status,
    notes: module.notes
  };
}

export function inferMessageItemType(item: MessageItem): MessageItemTypeValue {
  if (item.type !== undefined) {
    return item.type;
  }

  if (item.text_item) {
    return MessageItemType.TEXT;
  }

  if (item.image_item) {
    return MessageItemType.IMAGE;
  }

  if (item.voice_item) {
    return MessageItemType.VOICE;
  }

  if (item.file_item) {
    return MessageItemType.FILE;
  }

  if (item.video_item) {
    return MessageItemType.VIDEO;
  }

  throw new Error("Unable to infer outbound MessageItem type.");
}

export function buildOutboundItem(message: OutboundMessage): MessageItem {
  if (message.item && message.text) {
    throw new Error("OutboundMessage cannot provide both text and item.");
  }

  if (message.item) {
    return {
      ...message.item,
      type: inferMessageItemType(message.item)
    };
  }

  if (message.text !== undefined) {
    return {
      type: MessageItemType.TEXT,
      text_item: {
        text: message.text
      }
    };
  }

  throw new Error("OutboundMessage requires either text or item.");
}

export function buildSendMessageRequest(
  options: BuildSendMessageRequestOptions
): SendMessageReq {
  return {
    msg: {
      from_user_id: "",
      to_user_id: options.to,
      client_id: options.message.clientId ?? crypto.randomUUID(),
      message_type: MessageType.BOT,
      message_state: MessageState.FINISH,
      context_token: options.contextToken,
      ...(options.message.replyTo !== undefined
        ? {
            quoted_msg: {
              message_id: options.message.replyTo
            }
          }
        : {}),
      item_list: [buildOutboundItem(options.message)]
    }
  };
}

export function buildGetConfigRequest(userId: string, contextToken: string): GetConfigReq {
  return {
    ilink_user_id: userId,
    context_token: contextToken
  };
}

export function buildSendTypingRequest(
  userId: string,
  typingTicket: string,
  status: keyof typeof TypingStatus | "typing" | "cancel"
): SendTypingReq {
  return {
    ilink_user_id: userId,
    typing_ticket: typingTicket,
    status:
      status === "typing" || status === "TYPING" ? TypingStatus.TYPING : TypingStatus.CANCEL
  };
}
