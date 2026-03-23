# @openwx/bot

High-level bot lifecycle wrapper built on top of `@openwx/core`.

## Install

```bash
pnpm add @openwx/bot
```

## API

- `createBot(options, runtime?)`: build a managed bot instance
- `Bot#start()`: restore account or QR login, then begin polling
- `Bot#stop()`: stop polling, wait for in-flight handlers, and dispose the client
- Message helpers: `ctx.reply()`, `ctx.replyImage()`, `ctx.replyFile()`
- Command routing: `commands: { "/ping": handler }`
- Optional typing indicators: `autoTyping: true` or `autoTyping: { intervalMs }`

## Example

```ts
import { createBot } from "@openwx/bot";

const bot = createBot({
  autoTyping: true,
  commands: {
    "/ping": async () => ({ text: "pong" })
  },
  onMessage: async (ctx) => {
    if (ctx.text) {
      await ctx.reply(`Echo: ${ctx.text}`);
    }
  }
});

await bot.start();
```

## Notes

- `createBot()` requires `onMessage` or at least one command handler
- `autoDownloadMedia` enables convenience media handling for inbound assets
- `autoTyping` sends `typing` before handling and refreshes it until the reply finishes
- `qrDisplay` can be `"terminal"`, `"local-file"`, `"url-only"`, or a custom provider
