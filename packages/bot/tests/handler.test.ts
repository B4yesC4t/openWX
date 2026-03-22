import { describe, expect, it, vi } from "vitest";

import { createMessageContext, parseCommand } from "../src/handler.js";

describe("handler helpers", () => {
  it("parses slash commands and arguments", () => {
    expect(parseCommand("/help foo bar")).toStrictEqual({
      command: "/help",
      args: ["foo", "bar"]
    });
    expect(parseCommand("hello")).toBeNull();
    expect(parseCommand(" /image   cat ")).toStrictEqual({
      command: "/image",
      args: ["cat"]
    });
  });

  it("creates a rich message context", () => {
    const reply = vi.fn(async () => undefined);
    const replyImage = vi.fn(async () => undefined);
    const replyFile = vi.fn(async () => undefined);
    const media = {
      type: "file" as const,
      filePath: "/tmp/report.txt",
      mimeType: "text/plain",
      fileName: "report.txt",
      download: vi.fn(async () => Buffer.from("report")),
      save: vi.fn(async (targetPath: string) => targetPath)
    };

    const ctx = createMessageContext({
      message: {
        from_user_id: "user@im.wechat"
      },
      userId: "user@im.wechat",
      text: "ping",
      media,
      client: {} as never,
      reply,
      replyImage,
      replyFile
    });

    expect(ctx.userId).toBe("user@im.wechat");
    expect(ctx.text).toBe("ping");
    expect(ctx.media?.fileName).toBe("report.txt");
    expect(ctx.reply).toBe(reply);
    expect(ctx.replyImage).toBe(replyImage);
    expect(ctx.replyFile).toBe(replyFile);
  });
});
