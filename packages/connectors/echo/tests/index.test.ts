import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { MessageContext, MessageMedia } from "@openwx/bot";

import { createEchoConnector, createHandler } from "../src/index.js";

describe("createHandler", () => {
  it("echoes inbound text", async () => {
    const handler = createHandler();

    await expect(handler(createContext({ text: "hello" }))).resolves.toBe("hello");
  });

  it("reports image size in kilobytes", async () => {
    const handler = createHandler();

    await expect(
      handler(
        createContext({
          media: createMedia("image", Buffer.alloc(2048))
        })
      )
    ).resolves.toBe("收到图片 (2KB)");
  });

  it("reports file name and size in kilobytes", async () => {
    const handler = createHandler();

    await expect(
      handler(
        createContext({
          media: createMedia("file", Buffer.alloc(3072), "report.pdf")
        })
      )
    ).resolves.toBe("收到文件 report.pdf (3KB)");
  });

  it("exposes a connector factory compatible with hub runtime", async () => {
    const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "openwx-echo-"));
    const filePath = path.join(tempDirectory, "report.pdf");
    await writeFile(filePath, Buffer.alloc(3072));

    const connector = createEchoConnector();

    await expect(
      connector.handle({
        conversationId: "demo",
        text: "",
        media: {
          type: "file",
          filePath,
          mimeType: "application/pdf"
        }
      })
    ).resolves.toStrictEqual({
      text: "收到文件 report.pdf (3KB)"
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
    ...overrides
  } as MessageContext;
}

function createMedia(
  type: MessageMedia["type"],
  data: Buffer,
  fileName?: string
): MessageMedia {
  return {
    type,
    filePath: null,
    mimeType: type === "image" ? "image/png" : "application/octet-stream",
    ...(fileName !== undefined ? { fileName } : {}),
    download: vi.fn(async () => data),
    save: vi.fn(async (targetPath: string) => targetPath)
  };
}
