# @openwx/core

Protocol-facing TypeScript client for the official iLink Bot API.

## Install

```bash
pnpm add @openwx/core
```

## Key Exports

- `ILinkClient`: authenticated iLink client with QR login, polling, send, typing, and media helpers
- `randomWechatUin()`: correct `X-WECHAT-UIN` generator
- `SessionGuard`: one-hour cooldown handling for `errcode = -14`
- `FileSystemStore` and sync buffer helpers: persisted account and `get_updates_buf` storage
- `buildSendMessageRequest()` and related helpers: protocol payload construction

## Basic Usage

```ts
import { ILinkClient } from "@openwx/core";

const client = new ILinkClient({
  token: process.env.OPENWX_BOT_TOKEN,
  accountId: "demo-im-bot",
  storeDir: ".openwx"
});

client.on("message", async (message) => {
  await client.sendText(message.userId, "hello from core");
});

await client.startPolling();
```

## Important Behaviors

- Replies require the latest `context_token` for the user
- `get_updates_buf` is persisted to disk
- Session expiry triggers a one-hour pause through `SessionGuard`
- Media helpers use AES-128-ECB according to `DEVELOPMENT.md`

See the root [`README.md`](../../README.md) and [`DEVELOPMENT.md`](../../DEVELOPMENT.md) for protocol and architecture details.
