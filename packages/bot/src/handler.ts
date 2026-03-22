import type { ILinkClient, InboundMessage } from "@openwx/core";

export type BotMediaType = "image" | "video" | "file" | "voice";

export type Reply =
  | string
  | { text: string }
  | { text?: string; image: string }
  | { text?: string; file: string; fileName?: string }
  | void;

export interface MessageMedia {
  readonly type: BotMediaType;
  readonly filePath: string | null;
  readonly mimeType: string;
  readonly fileName?: string;
  download(): Promise<Buffer>;
  save(targetPath: string): Promise<string>;
}

export interface MessageContext {
  readonly message: InboundMessage["raw"];
  readonly userId: string;
  readonly text?: string;
  readonly media?: MessageMedia;
  readonly client: ILinkClient;
  reply(text: string): Promise<void>;
  replyImage(path: string): Promise<void>;
  replyFile(path: string, name?: string): Promise<void>;
}

export interface CommandContext extends MessageContext {
  readonly command: string;
  readonly args: readonly string[];
}

export type MessageHandler = (ctx: MessageContext) => Promise<Reply | void> | Reply | void;
export type CommandHandler = (ctx: CommandContext) => Promise<Reply | void> | Reply | void;
export type ErrorHandler = (error: Error, ctx: MessageContext) => Promise<void> | void;
export type CommandHandlers = Record<string, CommandHandler>;

export interface CommandMatch {
  readonly command: string;
  readonly args: readonly string[];
}

export interface MessageContextInit {
  readonly message: InboundMessage["raw"];
  readonly userId: string;
  readonly text?: string;
  readonly media?: MessageMedia;
  readonly client: ILinkClient;
  readonly reply: (text: string) => Promise<void>;
  readonly replyImage: (path: string) => Promise<void>;
  readonly replyFile: (path: string, name?: string) => Promise<void>;
}

export function parseCommand(text?: string): CommandMatch | null {
  if (!text) {
    return null;
  }

  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [command, ...args] = trimmed.split(/\s+/);
  if (!command || command === "/") {
    return null;
  }

  return {
    command,
    args
  };
}

export function createMessageContext(init: MessageContextInit): MessageContext {
  return {
    message: init.message,
    userId: init.userId,
    ...(init.text !== undefined ? { text: init.text } : {}),
    ...(init.media !== undefined ? { media: init.media } : {}),
    client: init.client,
    reply: init.reply,
    replyImage: init.replyImage,
    replyFile: init.replyFile
  };
}
