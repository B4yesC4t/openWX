import { readFile } from "node:fs/promises";

import type { MessageHandler } from "@openwx/bot";
import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

export function createHandler(): MessageHandler {
  return async (ctx) => {
    if (ctx.media?.type === "image") {
      return formatMediaSummary("image", await ctx.media.download());
    }

    if (ctx.media?.type === "file") {
      return formatMediaSummary("file", await ctx.media.download(), ctx.media.fileName);
    }

    return ctx.text;
  };
}

export function createEchoConnector(): Connector {
  return {
    id: "echo",
    async handle(request: ConnectorRequest): Promise<ConnectorResponse> {
      if (request.media?.type === "image") {
        const data = await readFile(request.media.filePath);
        return {
          text: formatMediaSummary("image", data)
        };
      }

      if (request.media?.type === "file") {
        const data = await readFile(request.media.filePath);
        return {
          text: formatMediaSummary("file", data, extractFileName(request.media.filePath))
        };
      }

      return request.text.length > 0 ? { text: request.text } : {};
    }
  };
}

export const createEchoHandler = createHandler;

function formatMediaSummary(
  type: "image" | "file",
  data: Buffer,
  fileName?: string
): string {
  const sizeInKb = toKilobytes(data.byteLength);

  if (type === "image") {
    return `收到图片 (${sizeInKb}KB)`;
  }

  return `收到文件 ${fileName ?? "未命名文件"} (${sizeInKb}KB)`;
}

function extractFileName(filePath: string): string | undefined {
  const segments = filePath.split(/[/\\]/);
  const name = segments.at(-1);
  return name && name.length > 0 ? name : undefined;
}

function toKilobytes(sizeInBytes: number): number {
  if (sizeInBytes <= 0) {
    return 0;
  }

  return Math.ceil(sizeInBytes / 1024);
}
