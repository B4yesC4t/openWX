import "dotenv/config";

import { createBot } from "@openwx/bot";
import { createOpenRouterHandler } from "@openwx/connectors";

const token = process.env.OPENWX_TOKEN?.trim();
const apiKey = process.env.OPENROUTER_API_KEY?.trim();

if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is required.");
}

const bot = createBot({
  ...(token ? { token } : {}),
  autoTyping: true,
  onMessage: createOpenRouterHandler({
    apiKey,
    ...(process.env.OPENROUTER_MODEL?.trim()
      ? { model: process.env.OPENROUTER_MODEL.trim() }
      : {}),
    ...(process.env.OPENROUTER_SITE_URL?.trim()
      ? { siteUrl: process.env.OPENROUTER_SITE_URL.trim() }
      : {}),
    ...(process.env.OPENROUTER_SITE_NAME?.trim()
      ? { siteName: process.env.OPENROUTER_SITE_NAME.trim() }
      : {})
  })
});

await bot.start();
