import "dotenv/config";
import { createBot } from "@openwx/bot";
import { formatEchoReply } from "./src/echo.js";

const token = process.env.OPENWX_TOKEN?.trim();

// Echo the inbound text in one handler. / 用一个处理函数回声回复收到的文本。
const bot = createBot({ ...(token ? { token } : {}), onMessage: (ctx) => formatEchoReply(ctx.text) });

await bot.start();
