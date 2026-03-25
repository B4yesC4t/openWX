# @openwx/bot

`@openwx/bot` 在 `@openwx/core` 之上提供更高层的 Bot 抽象。它把登录、恢复账号、轮询、消息上下文、命令处理和自动 typing 组织成一个更容易直接使用的 API。

`@openwx/bot` is the higher-level bot layer built on top of `@openwx/core`. It packages login, session restore, polling, message context, command handling, and auto typing into an easier API.

## 适合谁 / Who Should Use It

- 想快速写一个微信机器人或应用接入层
- 需要 `ctx.reply()`、`replyImage()`、`replyFile()` 这类上下文能力
- 希望默认使用二维码登录与自动恢复账号

- use it when building a WeChat bot or integration layer quickly
- use it when you want `ctx.reply()` and media helpers
- use it when you want QR-first login with session restore by default

## 安装 / Install

```bash
pnpm add @openwx/bot
```

## 最小示例 / Minimal Example

```ts
import { createBot } from "@openwx/bot";

const bot = createBot({
  autoTyping: true,
  onMessage: async (ctx) => `Echo: ${ctx.text ?? "(empty)"}`
});

await bot.start();
```

## 你会得到什么 / What You Get

- `createBot()`
- `onMessage` handler
- 命令式上下文 API
- 自动二维码登录 / 恢复登录态
- `autoTyping`
- 生命周期事件，如 `ready`

- `createBot()`
- an `onMessage` handler
- command-style context helpers
- QR login and session restore
- `autoTyping`
- lifecycle events such as `ready`

## 单应用与多应用 / Single-App vs Multi-App

单应用场景下，`@openwx/bot` 通常已经够用。
如果要根据前缀把消息分给不同 handler，再配合 `@openwx/hub` 使用。

For single-app use cases, `@openwx/bot` is usually enough.
Use it with `@openwx/hub` when prefixes should route messages to different handlers.

## 相关文档 / Related Docs

- [根 README](../../README.md)
- [Examples](../../examples/README.md)
- [Hub](../hub/README.md)
