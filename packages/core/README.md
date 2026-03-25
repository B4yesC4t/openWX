# @openwx/core

`@openwx/core` 是 openWX 的底层 SDK，负责和微信侧协议直接交互。它提供二维码登录、账号恢复、轮询、收发消息、媒体上传下载、typing 和本地持久化等能力。

`@openwx/core` is the low-level SDK in openWX. It talks to the WeChat-side protocol directly and provides QR login, session restore, polling, messaging, media upload/download, typing, and local persistence.

## 适合谁 / Who Should Use It

- 你需要完全控制登录、轮询和消息生命周期
- 你要自己实现 Bot 框架或服务层
- 你要接入自己的存储、监控或调度体系

- use it when you need full control over login, polling, and message flow
- use it when building your own bot framework or service layer
- use it when integrating custom storage, monitoring, or orchestration

## 安装 / Install

```bash
pnpm add @openwx/core
```

## 核心能力 / Core Capabilities

- `ILinkClient`: 请求封装与核心 API
- `login()`: 二维码登录
- `restoreAccount()`: 恢复本地登录态
- `startPolling()`: 长轮询收消息
- `sendText()` / `sendImage()` / `sendFile()`
- `sendTyping()` / `cancelTyping()`
- 二维码展示与本地存储

- `ILinkClient`: request wrapper and core APIs
- `login()`: QR-based login
- `restoreAccount()`: restore local session
- `startPolling()`: long polling
- `sendText()` / `sendImage()` / `sendFile()`
- `sendTyping()` / `cancelTyping()`
- QR display and local persistence

## 最小示例 / Minimal Example

```ts
import { ILinkClient, login, restoreAccount } from "@openwx/core";

const client = new ILinkClient();
const account = (await restoreAccount()) ?? (await login({ client }));

await client.sendText({
  token: account.token,
  toUserName: "wxid_xxx",
  content: "hello from openWX"
});
```

## 何时不要直接用它 / When Not to Use It Directly

如果你只是想快速写一个可用的微信应用，通常优先用 `@openwx/bot`。
如果你要做多应用分发，优先看 `@openwx/hub`。

If you only want a working WeChat app quickly, start with `@openwx/bot`.
If you need multi-app routing, start with `@openwx/hub`.

## 相关文档 / Related Docs

- [根 README](../../README.md)
- [Bot](../bot/README.md)
- [Hub](../hub/README.md)
