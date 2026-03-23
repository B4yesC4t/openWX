# openWX

[![npm version](https://img.shields.io/npm/v/%40openwx%2Fbot?label=%40openwx%2Fbot)](https://www.npmjs.com/package/@openwx/bot)
[![CI](https://github.com/B4yesC4t/openWX/actions/workflows/ci.yml/badge.svg)](https://github.com/B4yesC4t/openWX/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](./LICENSE)
[![npm downloads](https://img.shields.io/npm/dm/%40openwx%2Fbot?label=downloads)](https://www.npmjs.com/package/@openwx/bot)

合法连接应用与 AI Agent 到微信官方 iLink Bot API 的 TypeScript SDK。  
An open-source TypeScript SDK for connecting apps and AI agents to WeChat through the official iLink Bot API.

## Features | 特性

- `@openwx/core`: iLink auth, long polling, message send helpers, media upload/download, session cooldown, persistence
- `@openwx/bot`: `createBot()` lifecycle wrapper with commands, message handlers, media helpers, and QR login fallback
- `@openwx/hub`: runnable multi-app routing config with connector loading and prefix/keyword/user matchers
- `@openwx/connector-*`: connector factories and handler helpers for Claude Code, Codex, OpenRouter, echo bots, and HTTP proxies
- Monorepo with pnpm workspaces, TypeScript, Vitest, ESLint, and Node.js 20+

## Package Map | 包结构

| Package                                                                        | Purpose                                                     |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| [`@openwx/core`](./packages/core/README.md)                                    | Protocol-facing client, auth, polling, media, crypto, store |
| [`@openwx/bot`](./packages/bot/README.md)                                      | Developer-friendly bot lifecycle and handler APIs           |
| [`@openwx/hub`](./packages/hub/README.md)                                      | Multi-app router scaffold and route config helpers          |
| [`packages/connectors`](./packages/connectors/README.md)                       | Connector package index and shared contract                 |
| [`@openwx/connector-echo`](./packages/connectors/echo/README.md)               | Minimal echo connector                                      |
| [`@openwx/connector-http-proxy`](./packages/connectors/http-proxy/README.md)   | HTTP upstream connector                                     |
| [`@openwx/connector-claude-code`](./packages/connectors/claude-code/README.md) | Claude Code connector scaffold                              |
| [`@openwx/connector-codex`](./packages/connectors/codex/README.md)             | Codex CLI connector                                         |
| [`@openwx/connector-openrouter`](./packages/connectors/openrouter/README.md)   | OpenRouter chatbot connector                                |

## Quick Start | 快速开始

### 1. Install | 安装

```bash
pnpm add @openwx/bot
```

### 2. Create a bot | 创建 Bot

```ts
import { createBot } from "@openwx/bot";

const bot = createBot({
  onMessage: async (ctx) => {
    await ctx.reply(`Echo: ${ctx.text ?? "收到消息"}`);
  }
});
```

### 3. Start polling | 启动

```ts
await bot.start();
```

If no token is configured, `@openwx/bot` restores a saved account first and otherwise falls back to QR login.  
如果没有提供 token，`@openwx/bot` 会先尝试恢复本地账号，否则自动进入扫码登录流程。

## Installation Matrix | 安装指南

Install only the layer you need:

```bash
pnpm add @openwx/core
pnpm add @openwx/bot
pnpm add @openwx/hub
pnpm add @openwx/connector-echo
pnpm add @openwx/connector-http-proxy
pnpm add @openwx/connector-claude-code
pnpm add @openwx/connector-codex
pnpm add @openwx/connector-openrouter
```

- `@openwx/core`: use when you need direct protocol control
- `@openwx/bot`: use when you want the default app-facing abstraction
- `@openwx/hub`: use when you want prefix-based routing across multiple backends
- Connector packages: use when you need a pre-shaped integration entry point

## API Reference | API 文档

The repository currently exposes a tested scaffold surface. The signatures below reflect the code in `packages/*/src` today.

### `ILinkClient` (`@openwx/core`)

```ts
class ILinkClient extends EventEmitter {
  constructor(options?: ILinkClientOptions);

  getLoginQRCode(
    options?: Omit<AuthRequestOptions, "baseUrl">
  ): Promise<LoginQRCode>;
  waitForScan(
    sessionKey: string,
    options?: Omit<WaitForScanOptions, "baseUrl">
  ): Promise<ScanResult>;
  login(
    options?: Omit<LoginOptions, "baseUrl" | "store" | "qrDisplay">
  ): Promise<LoginResult>;
  restoreAccount(accountId?: string): boolean;
  apiFetch<TResponse, TBody extends object = Record<string, unknown>>(
    endpoint: string,
    body?: TBody
  ): Promise<TResponse>;
  startPolling(options?: StartPollingOptions): Promise<void>;
  send(to: string, message: OutboundMessage): Promise<SendMessageResp>;
  sendText(
    to: string,
    text: string,
    options?: string | SendTextOptions
  ): Promise<SendMessageResp>;
  sendImage(to: string, filePath: string): Promise<SendMessageResp>;
  sendVideo(to: string, filePath: string): Promise<SendMessageResp>;
  sendFile(
    to: string,
    filePath: string,
    fileName?: string
  ): Promise<SendMessageResp>;
  getConfig(userId: string | GetConfigReq): Promise<GetConfigResp>;
  sendTyping(userId: string | SendTypingReq): Promise<SendTypingResp>;
  cancelTyping(userId: string | SendTypingReq): Promise<SendTypingResp>;
  uploadMedia(
    to: string,
    filePath: string,
    type: MediaTypeValue
  ): Promise<unknown>;
  downloadMedia(media: CDNMedia): Promise<Buffer>;
  dispose(): void;
}
```

```ts
import { ILinkClient } from "@openwx/core";

const client = new ILinkClient({
  token: process.env.OPENWX_BOT_TOKEN,
  accountId: "bot-im-bot",
  storeDir: ".openwx"
});

client.on("message", async (message) => {
  await client.sendText(message.userId, `收到: ${message.text ?? "媒体消息"}`);
});

await client.startPolling();
```

### `createBot` (`@openwx/bot`)

```ts
interface CreateBotOptions {
  token?: string;
  accountId?: string;
  onMessage?: MessageHandler;
  onError?: ErrorHandler;
  commands?: Record<string, CommandHandler>;
  storeDir?: string;
  qrDisplay?: BuiltInQRDisplay | QRDisplayProvider;
  autoDownloadMedia?: boolean;
  autoTyping?: boolean | { intervalMs?: number; cancelOnFinish?: boolean };
}

function createBot(
  options: CreateBotOptions,
  runtime?: CreateBotRuntimeOptions
): Bot;
```

```ts
import { createBot } from "@openwx/bot";

const bot = createBot({
  autoTyping: true,
  commands: {
    "/ping": async (ctx) => ({ text: `pong ${ctx.args.join(" ")}` })
  },
  onMessage: async (ctx) => {
    if (ctx.text?.includes("image")) {
      await ctx.reply("图片处理示例见 media-bot example。");
    }
  }
});

bot.on("ready", () => {
  console.log("openWX bot is running");
});

await bot.start();
```

### Hub Configuration (`@openwx/hub`)

```ts
interface HubRouteConfig {
  handler: string;
  config?: Record<string, unknown>;
  prefix?: string;
  keywords?: readonly string[];
  users?: readonly string[];
  pattern?: string;
  default?: boolean;
  stripPrefix?: boolean;
}

interface HubConfig {
  auth?: {
    token?: string;
    accountId?: string;
    storeDir?: string;
    autoDownloadMedia?: boolean;
    autoTyping?: boolean;
  };
  routes: readonly HubRouteConfig[];
}

function defineHubConfig(config: HubConfig): HubConfig;
function describeHub(config: HubConfig): {
  config: HubConfig;
  router: {
    packageName: "@openwx/hub";
    routeCount: number;
    botPackage: string;
  };
};
function createHub(config: HubConfig): Promise<HubRuntime>;
```

```ts
import { createHub, defineHubConfig, describeHub } from "@openwx/hub";

const config = defineHubConfig({
  routes: [
    {
      prefix: "/support",
      handler: "http-proxy",
      config: {
        endpoint: "https://example.internal/openwx"
      }
    }
  ]
});

const described = describeHub(config);
console.log(described.router.routeCount);

const runtime = await createHub(config);
await runtime.bot.start();
```

## Architecture | 架构图

```mermaid
flowchart LR
  User[WeChat User]
  API[iLink Bot API]
  Core[@openwx/core]
  Bot[@openwx/bot]
  Hub[@openwx/hub]
  Conn[@openwx/connector-*]
  App[Your App or Agent]

  User <-- messages --> API
  API <-- protocol + media --> Core
  Core --> Bot
  Core --> Hub
  Hub --> Conn
  Bot --> App
  Conn --> App
```

## Examples | 示例索引

- [`examples/assistant`](./examples/assistant/README.md): end-user-friendly assistant entry with provider selection and QR-first login
- [`examples/minimal`](./examples/minimal/README.md): smallest bot skeleton
- [`examples/media-bot`](./examples/media-bot/README.md): media handling placeholder
- [`examples/multi-app`](./examples/multi-app/README.md): hub routing with Claude, Codex, OpenRouter, and Echo
- [`examples/openrouter-chatbot`](./examples/openrouter-chatbot/README.md): smallest OpenRouter chatbot case
- [`examples/desktop-agent`](./examples/desktop-agent/README.md): desktop agent placeholder
- [`protocol/README.md`](./protocol/README.md): pointer to the full protocol reference in [`DEVELOPMENT.md`](./DEVELOPMENT.md)

## FAQ | 常见问题

### 1. Is openWX production-ready?

The monorepo already contains tested protocol and lifecycle scaffolds, but some higher-level packages are intentionally lightweight. Check each package README before adopting it in production.

### 2. Why does replying require `context_token`?

Because iLink associates replies with the active conversation through `context_token`. Missing it means users may not see the reply in the intended thread.

### 3. What happens when the bot session expires?

`errcode = -14` means the session is invalid. `@openwx/core` models the required one-hour cooldown through `SessionGuard`.

### 4. Does `get_updates_buf` survive restarts?

Yes. The core store layer persists the polling cursor so a restart does not replay large amounts of history.

### 5. Can I log in without storing a token manually?

Yes. `ILinkClient` and `createBot()` can restore a saved account or fall back to QR login.

### 6. Are media uploads encrypted?

Yes. The core media helpers implement AES-128-ECB upload and download handling based on the protocol notes in `DEVELOPMENT.md`.

### 7. Which package should I start with?

Start with `@openwx/bot` for app development, `@openwx/core` for direct protocol control, and `@openwx/hub` only if you need multi-target routing.

### 8. Where are the full protocol notes?

See [`DEVELOPMENT.md`](./DEVELOPMENT.md). It is the authoritative protocol and architecture reference for this repository.

## Contributing | 参与贡献

Contribution workflow, branch strategy, commit format, and PR requirements live in [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## License

MIT. See [`LICENSE`](./LICENSE).
