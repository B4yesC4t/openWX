import type { SessionGuard } from "./session.js";
import type { Store, SyncBufferStore } from "./store.js";
import type { BuiltInQRDisplay, QRDisplayProvider } from "./qr-display.js";

/**
 * Shared scaffold shape kept for modules that are not implemented in this ticket.
 */
export interface ScaffoldModule {
  readonly packageName: string;
  readonly status: "scaffolded";
  readonly notes: readonly string[];
}

/**
 * Generic connector request placeholder used by the current monorepo scaffold.
 */
export interface ConnectorRequest {
  readonly conversationId: string;
  readonly text: string;
  readonly media?: {
    readonly type: string;
    readonly filePath: string;
    readonly mimeType: string;
  };
}

/**
 * Generic connector response placeholder used by the current monorepo scaffold.
 */
export interface ConnectorResponse {
  readonly text?: string;
  readonly media?: {
    readonly type: string;
    readonly url: string;
    readonly fileName?: string;
  };
}

/**
 * Minimal connector contract used by scaffold packages.
 */
export interface Connector {
  readonly id: string;
  handle(request: ConnectorRequest): Promise<ConnectorResponse>;
}

/**
 * Helper for scaffold-oriented modules that still return placeholder metadata.
 */
export function createScaffoldModule(
  packageName: string,
  notes: readonly string[]
): ScaffoldModule {
  return {
    packageName,
    status: "scaffolded",
    notes
  };
}

/**
 * Every iLink POST body carries `base_info` with fixed protocol metadata.
 */
export interface BaseInfo {
  /** Fixed iLink bot type. */
  bot_type?: string;
  /** Optional channel version observed in protocol examples. */
  channel_version?: string;
}

/**
 * Media type enum used by `getuploadurl`.
 */
export const UploadMediaType = {
  IMAGE: 1,
  VIDEO: 2,
  FILE: 3,
  VOICE: 4
} as const;

/**
 * Union type for upload media enum values.
 */
export type UploadMediaTypeValue = (typeof UploadMediaType)[keyof typeof UploadMediaType];

/**
 * Direction/source of a WeChat message.
 */
export const MessageType = {
  NONE: 0,
  USER: 1,
  BOT: 2
} as const;

/**
 * Union type for `MessageType`.
 */
export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/**
 * Concrete item payload carried inside a message.
 */
export const MessageItemType = {
  NONE: 0,
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5
} as const;

/**
 * Union type for `MessageItemType`.
 */
export type MessageItemTypeValue = (typeof MessageItemType)[keyof typeof MessageItemType];

/**
 * Delivery/generation state of a message.
 */
export const MessageState = {
  NEW: 0,
  GENERATING: 1,
  FINISH: 2
} as const;

/**
 * Union type for `MessageState`.
 */
export type MessageStateValue = (typeof MessageState)[keyof typeof MessageState];

/**
 * Typing indicator status used by `sendtyping`.
 */
export const TypingStatus = {
  TYPING: 1,
  CANCEL: 2
} as const;

/**
 * Union type for `TypingStatus`.
 */
export type TypingStatusValue = (typeof TypingStatus)[keyof typeof TypingStatus];

/**
 * CDN media descriptor returned by iLink for encrypted media download.
 */
export interface CDNMedia {
  /** Encrypted download query string used with the CDN endpoint. */
  encrypt_query_param?: string;
  /** AES-128 media key encoded with base64 in protocol payloads. */
  aes_key?: string;
  /** Encryption mode metadata from iLink. */
  encrypt_type?: number;
}

/**
 * Text message payload.
 */
export interface TextItem {
  /** Visible text content. */
  text?: string;
}

/**
 * Image message payload.
 */
export interface ImageItem {
  /** Original encrypted media reference. */
  media?: CDNMedia;
  /** Thumbnail media reference. */
  thumb_media?: CDNMedia;
  /** Optional raw AES key in hex format. */
  aeskey?: string;
  /** Optional image URL from upstream implementations. */
  url?: string;
  /** Mid-size asset size in bytes. */
  mid_size?: number;
  /** Thumbnail size in bytes. */
  thumb_size?: number;
  /** Thumbnail height in pixels. */
  thumb_height?: number;
  /** Thumbnail width in pixels. */
  thumb_width?: number;
  /** HD image size in bytes. */
  hd_size?: number;
}

/**
 * Voice message payload.
 */
export interface VoiceItem {
  /** Encrypted media reference for the audio blob. */
  media?: CDNMedia;
  /** Audio encoding type. */
  encode_type?: number;
  /** Sample precision. */
  bits_per_sample?: number;
  /** Sample rate in Hz. */
  sample_rate?: number;
  /** Playback duration in milliseconds. */
  playtime?: number;
  /** Speech-to-text result if provided by iLink. */
  text?: string;
}

/**
 * File message payload.
 */
export interface FileItem {
  /** Encrypted media reference for the file blob. */
  media?: CDNMedia;
  /** Original file name. */
  file_name?: string;
  /** File MD5 in hex format. */
  md5?: string;
  /** File size in bytes, serialized by iLink as a string. */
  len?: string;
}

/**
 * Video message payload.
 */
export interface VideoItem {
  /** Encrypted media reference for the video blob. */
  media?: CDNMedia;
  /** Video size in bytes. */
  video_size?: number;
  /** Playback duration. */
  play_length?: number;
  /** Video MD5 in hex format. */
  video_md5?: string;
  /** Thumbnail media reference. */
  thumb_media?: CDNMedia;
  /** Thumbnail size in bytes. */
  thumb_size?: number;
  /** Thumbnail height in pixels. */
  thumb_height?: number;
  /** Thumbnail width in pixels. */
  thumb_width?: number;
}

/**
 * Reference to an earlier message quoted by the current item.
 */
export interface RefMessage {
  /** The quoted message item. */
  message_item?: MessageItem;
  /** Short quote summary shown to users. */
  title?: string;
}

/**
 * Reference to an earlier message quoted by an outbound reply.
 */
export interface QuotedMessage {
  /** Server message ID being quoted. */
  message_id?: number | string;
}

/**
 * Single item inside a Weixin message payload.
 */
export interface MessageItem {
  /** Concrete item type. */
  type?: MessageItemTypeValue;
  /** Creation timestamp in milliseconds. */
  create_time_ms?: number;
  /** Update timestamp in milliseconds. */
  update_time_ms?: number;
  /** Whether the item stream finished generating. */
  is_completed?: boolean;
  /** Server-side message item ID. */
  msg_id?: string;
  /** Optional quoted message metadata. */
  ref_msg?: RefMessage;
  /** Text payload when `type=TEXT`. */
  text_item?: TextItem;
  /** Image payload when `type=IMAGE`. */
  image_item?: ImageItem;
  /** Voice payload when `type=VOICE`. */
  voice_item?: VoiceItem;
  /** File payload when `type=FILE`. */
  file_item?: FileItem;
  /** Video payload when `type=VIDEO`. */
  video_item?: VideoItem;
}

/**
 * Raw message entity returned by `getupdates` and submitted to `sendmessage`.
 */
export interface WeixinMessage {
  /** Monotonic sequence number from iLink. */
  seq?: number;
  /** Numeric server message ID. */
  message_id?: number;
  /** Sender iLink user ID. */
  from_user_id?: string;
  /** Receiver iLink user ID. */
  to_user_id?: string;
  /** Client-generated unique message ID. */
  client_id?: string;
  /** Creation timestamp in milliseconds. */
  create_time_ms?: number;
  /** Update timestamp in milliseconds. */
  update_time_ms?: number;
  /** Delete timestamp in milliseconds. */
  delete_time_ms?: number;
  /** Conversation session ID. */
  session_id?: string;
  /** Group ID for group chats when applicable. */
  group_id?: string;
  /** Message direction/type. */
  message_type?: MessageTypeValue;
  /** Message generation state. */
  message_state?: MessageStateValue;
  /** Concrete content items. */
  item_list?: MessageItem[];
  /** Conversation token that must be echoed back in replies. */
  context_token?: string;
  /** Optional outbound quote reference. */
  quoted_msg?: QuotedMessage;
}

/**
 * Common response envelope used by most iLink POST endpoints.
 */
export interface ApiResponse {
  /** iLink return code. */
  ret?: number;
  /** Detailed error code. */
  errcode?: number;
  /** Human-readable message from iLink. */
  errmsg?: string;
}

/**
 * `getupdates` request payload.
 */
export interface GetUpdatesReq {
  /** Cursor returned by the previous poll. */
  get_updates_buf?: string;
  /** Requested server long-poll timeout in milliseconds. */
  timeout?: number;
  /** Shared request metadata. */
  base_info?: BaseInfo;
}

/**
 * `getupdates` response payload.
 */
export interface GetUpdatesResp extends ApiResponse {
  /** Newly received messages. */
  msgs?: WeixinMessage[];
  /** Cursor for the next poll. */
  get_updates_buf?: string;
  /** Suggested server long-poll timeout in milliseconds. */
  longpolling_timeout_ms?: number;
}

/**
 * `sendmessage` request payload.
 */
export interface SendMessageReq {
  /** Message being sent to iLink. */
  msg?: WeixinMessage;
  /** Shared request metadata. */
  base_info?: BaseInfo;
}

/**
 * `sendmessage` response payload.
 */
export interface SendMessageResp extends ApiResponse {
  /** Optional accepted message ID returned by upstream. */
  message_id?: number | string;
}

/**
 * `getuploadurl` request payload.
 */
export interface GetUploadUrlReq {
  /** Random file key used by iLink/CDN. */
  filekey?: string;
  /** Media category for the upload. */
  media_type?: UploadMediaTypeValue;
  /** Target user that will receive the media. */
  to_user_id?: string;
  /** Plaintext file size in bytes. */
  rawsize?: number;
  /** Plaintext MD5 in hex format. */
  rawfilemd5?: string;
  /** Ciphertext size in bytes after AES padding. */
  filesize?: number;
  /** Thumbnail plaintext size when applicable. */
  thumb_rawsize?: number;
  /** Thumbnail plaintext MD5 when applicable. */
  thumb_rawfilemd5?: string;
  /** Thumbnail ciphertext size when applicable. */
  thumb_filesize?: number;
  /** Whether thumbnail upload can be skipped. */
  no_need_thumb?: boolean;
  /** AES key in hex format. */
  aeskey?: string;
  /** Shared request metadata. */
  base_info?: BaseInfo;
}

/**
 * `getuploadurl` response payload.
 */
export interface GetUploadUrlResp extends ApiResponse {
  /** CDN upload token for the main file. */
  upload_param?: string;
  /** CDN upload token for the thumbnail. */
  thumb_upload_param?: string;
}

/**
 * `getconfig` request payload.
 */
export interface GetConfigReq {
  /** User that owns the typing ticket. */
  ilink_user_id?: string;
  /** Conversation token to scope the config request. */
  context_token?: string;
  /** Shared request metadata. */
  base_info?: BaseInfo;
}

/**
 * `getconfig` response payload.
 */
export interface GetConfigResp extends ApiResponse {
  /** Base64-encoded typing ticket. */
  typing_ticket?: string;
}

/**
 * `sendtyping` request payload.
 */
export interface SendTypingReq {
  /** Target user for the typing indicator. */
  ilink_user_id?: string;
  /** Typing ticket previously returned by `getconfig`. */
  typing_ticket?: string;
  /** Current typing status. */
  status?: TypingStatusValue;
  /** Shared request metadata. */
  base_info?: BaseInfo;
}

/**
 * `sendtyping` response payload.
 */
export type SendTypingResp = ApiResponse;

/**
 * Runtime configuration for the iLink HTTP client.
 */
export interface ILinkClientOptions {
  /** API base URL, defaults to Tencent's public iLink endpoint. */
  readonly baseUrl?: string;
  /** CDN base URL for encrypted media upload/download. */
  readonly cdnBaseUrl?: string;
  /** Bot token used for Bearer authentication. */
  readonly token?: string;
  /** Optional persistence directory reserved for follow-up tickets. */
  readonly storeDir?: string;
  /** Optional route tag header forwarded to iLink. */
  readonly skRouteTag?: string;
  /** Optional protocol channel version sent in `base_info`. */
  readonly channelVersion?: string;
  /** Persistence identity used for sync-buf storage and session cooldowns. */
  readonly accountId?: string;
  /** Optional store implementation for tokens and get_updates_buf persistence. */
  readonly store?: Store;
  /** QR display strategy used during `login()`. */
  readonly qrDisplay?: QRDisplayProvider | BuiltInQRDisplay;
  /**
   * Optional injected sync-buf persistence implementation kept for compatibility with
   * polling-focused callers. When `store` is provided, it is used for both account and cursor state.
   */
  readonly syncStore?: SyncBufferStore;
  /** Optional injected session cooldown guard. */
  readonly sessionGuard?: SessionGuard;
}

/**
 * Options for a single `poll()` invocation.
 */
export interface PollOptions {
  /** Cursor returned by the previous poll. */
  readonly getUpdatesBuf?: string;
  /** Override the long-poll timeout for this request. */
  readonly timeoutMs?: number;
  /** Abort signal used by the caller. */
  readonly signal?: AbortSignal;
}

/**
 * Minimal outbound message abstraction accepted by `ILinkClient.send()`.
 */
export interface OutboundMessage {
  /** Optional caller-supplied client ID. */
  readonly clientId?: string;
  /** Text content for simple replies. */
  readonly text?: string;
  /** Fully constructed message item for non-text sends. */
  readonly item?: MessageItem;
  /** Optional quoted server message ID attached to the reply. */
  readonly replyTo?: number | string;
}

/**
 * Convenience options for `ILinkClient.sendText()`.
 */
export interface SendTextOptions {
  /** Optional caller-supplied client ID. */
  readonly clientId?: string;
  /** Optional quoted server message ID attached to the reply. */
  readonly replyTo?: number | string;
}

/**
 * Structured inbound item types exposed by the runtime client.
 */
export const InboundMessageItemKind = {
  TEXT: "text",
  IMAGE: "image",
  VIDEO: "video",
  FILE: "file",
  VOICE: "voice"
} as const;

/**
 * Union type for `InboundMessageItemKind`.
 */
export type InboundMessageItemKindValue =
  (typeof InboundMessageItemKind)[keyof typeof InboundMessageItemKind];

/**
 * Structured inbound message emitted by the runtime client.
 */
export interface InboundMessage {
  /** Original raw iLink payload. */
  readonly raw: WeixinMessage;
  /** Sender iLink user ID. */
  readonly fromUserId?: string;
  /** Receiver iLink user ID. */
  readonly toUserId?: string;
  /** Message context token echoed back when replying. */
  readonly contextToken?: string;
  /** Conversation session ID. */
  readonly sessionId?: string;
  /** Message sequence returned by iLink. */
  readonly seq?: number;
  /** Message ID returned by iLink. */
  readonly messageId?: number;
  /** Original item list returned by iLink. */
  readonly itemList: readonly MessageItem[];
  /** Highest-priority item selected from `item_list`. */
  readonly primaryItem?: MessageItem;
  /** Normalized type for `primaryItem`. */
  readonly primaryItemKind?: InboundMessageItemKindValue;
  /** Extracted textual content, including quoted text when present. */
  readonly text?: string;
}

/**
 * Normalized result returned by `ILinkClient.poll()`.
 */
export interface PollResult {
  /** Structured inbound messages returned in this poll cycle. */
  readonly messages: InboundMessage[];
  /** Raw `getupdates` messages returned by iLink. */
  readonly rawMessages: WeixinMessage[];
  /** Cursor to be persisted and supplied on the next poll. */
  readonly getUpdatesBuf?: string;
  /** Suggested timeout from the server when present. */
  readonly longPollingTimeoutMs?: number;
  /** Whether the poll detected an expired session. */
  readonly sessionExpired: boolean;
}

/**
 * Runtime options for the managed polling loop.
 */
export interface StartPollingOptions {
  /** Optional abort signal used to stop the loop. */
  readonly signal?: AbortSignal;
  /** Optional initial cursor override. */
  readonly getUpdatesBuf?: string;
  /** Optional initial long-poll timeout override. */
  readonly timeoutMs?: number;
}

/**
 * Typed event payloads emitted by `ILinkClient`.
 *
 * The tuple form matches Node.js `EventEmitter` argument lists.
 */
export interface ILinkClientEvents {
  /** Fired for each inbound message returned by `poll()`. */
  message: [message: InboundMessage];
  /** Fired when an operation fails and the error is surfaced to the caller. */
  error: [error: Error];
  /** Fired once after the first successful authenticated request. */
  ready: [];
  /** Fired when `dispose()` stops the client. */
  stopped: [];
  /** Fired when `getupdates` returns `errcode=-14`. */
  sessionExpired: [accountId: string];
}
