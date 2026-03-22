import "dotenv/config";
import { fileURLToPath } from "node:url";

import { createBot, type MessageContext, type MessageHandler } from "@openwx/bot";
import { createClaudeCodeHandler, createEchoHandler } from "@openwx/connectors";
import { describeHub } from "@openwx/hub";

import { loadHubConfig } from "./src/config.js";
import { buildHelpText, matchRoute } from "./src/router.js";

const config = loadHubConfig(fileURLToPath(new URL("./hub.yaml", import.meta.url)));
const hub = describeHub(config);
const token = process.env.OPENWX_TOKEN?.trim();
const handlers = new Map<string, MessageHandler>([
  ["claude-code", createClaudeCodeHandler()],
  ["echo", createEchoHandler()]
]);

const bot = createBot({
  ...(token ? { token } : {}),
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
});

await bot.start();

function withText(ctx: MessageContext, text: string): MessageContext {
  return {
    ...ctx,
    text
  };
}
