import "dotenv/config";
import { fileURLToPath } from "node:url";

import { createBot, type MessageContext, type MessageHandler } from "@openwx/bot";
import { describeHub } from "@openwx/hub";

import { loadHubConfig } from "./src/config.js";
import { createMultiAppHandlers } from "./src/handlers.js";
import { createLoginQrDisplayProvider, resolveDefaultLoginQrPath } from "./src/qr-login.js";
import { buildHelpText, matchRoute } from "./src/router.js";
import { resolveOpenRouterSettings } from "./src/runtime-config.js";

const config = loadHubConfig(fileURLToPath(new URL("./hub.yaml", import.meta.url)));
const hub = describeHub(config);
const token = process.env.OPENWX_TOKEN?.trim();
const openRouter = await resolveOpenRouterSettings();
const handlers = createMultiAppHandlers(openRouter);
const qrImagePath = process.env.OPENWX_QR_IMAGE?.trim() || resolveDefaultLoginQrPath();

const bot = createBot({
  ...(token ? { token } : {}),
  autoTyping: true,
  qrDisplay: createLoginQrDisplayProvider({
    outputPath: qrImagePath
  }),
  onMessage: async (ctx) => {
    // Route by the same hub.yaml config used for deployment. / 用部署配置同源的 hub.yaml 做运行时分发。
    const route = matchRoute(ctx.text ?? "", hub.router);
    if (route.kind === "handler") {
      const handler = handlers.get(route.handler);
      if (handler) {
        return handler(withText(ctx, route.forwardedText));
      }
    }

    return buildHelpText(config, hub.router.routeCount);
  }
});

bot.on("ready", () => {
  console.log(`Hub example ready with ${hub.router.routeCount} routes.`);
  if (!token) {
    console.log(`First-run login uses QR image: ${qrImagePath}`);
  }
  if (openRouter.apiKey) {
    console.log(`OpenRouter route enabled with model ${openRouter.model}.`);
  } else {
    console.log("OpenRouter route is available but not configured yet. Send /router after adding a key.");
  }
});

await bot.start();

function withText(ctx: MessageContext, text: string): MessageContext {
  return {
    ...ctx,
    text
  };
}
