import "dotenv/config";
import { createBot } from "@openwx/bot";

import { exampleAssetPath } from "./src/assets.js";
import { describeImage } from "./src/image-summary.js";

const token = process.env.OPENWX_TOKEN?.trim();

const bot = createBot({
  ...(token ? { token } : {}),
  autoTyping: true,
  commands: {
    "/cat": async () => ({ text: "送你一只本地猫图。", image: exampleAssetPath("cat.svg") }),
    "/readme": async () => ({ text: "把示例说明也发给你。", file: exampleAssetPath("../README.md"), fileName: "README.md" })
  },
  onMessage: async (ctx) => {
    // Download + inspect inbound media. / 下载并分析收到的媒体内容。
    if (ctx.media?.type === "image") {
      const { width, height } = describeImage(await ctx.media.download());
      return `收到 ${width}x${height} 的图片`;
    }

    return "发送图片，或输入 /cat、/readme 体验媒体能力。";
  }
});

await bot.start();
