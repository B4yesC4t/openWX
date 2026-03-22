import type { MessageHandler } from "@openwx/bot";

export function createHandler(): MessageHandler {
  return async (ctx) => {
    if (ctx.media?.type === "image") {
      const sizeInKb = toKilobytes((await ctx.media.download()).byteLength);
      return `收到图片 (${sizeInKb}KB)`;
    }

    if (ctx.media?.type === "file") {
      const sizeInKb = toKilobytes((await ctx.media.download()).byteLength);
      const fileName = ctx.media.fileName ?? "未命名文件";
      return `收到文件 ${fileName} (${sizeInKb}KB)`;
    }

    return ctx.text;
  };
}

export const createEchoHandler = createHandler;

function toKilobytes(sizeInBytes: number): number {
  if (sizeInBytes <= 0) {
    return 0;
  }

  return Math.ceil(sizeInBytes / 1024);
}
