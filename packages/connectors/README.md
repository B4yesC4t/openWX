# @openwx/connectors

`@openwx/connectors` 提供了一组现成的 connector 和 handler，用来把不同类型的应用接进微信。

`@openwx/connectors` provides ready-to-use connectors and handlers for exposing different kinds of apps through WeChat.

## 内置 connector / Built-In Connectors

- `createClaudeCodeHandler()` / `createClaudeCodeConnector()`
- `createCodexHandler()` / `createCodexConnector()`
- `createOpenRouterHandler()` / `createOpenRouterConnector()`
- `createHttpProxyHandler()` / `createHttpProxyConnector()`
- `createEchoHandler()` / `createEchoConnector()`

## 适用场景 / Use Cases

- 本地 CLI agent，例如 Claude Code 或 Codex
- 第三方模型平台，例如 OpenRouter
- 你自己的 HTTP chatbot / app
- 调试和 smoke test

- local CLI agents such as Claude Code or Codex
- hosted model platforms such as OpenRouter
- your own HTTP chatbot or app
- debugging and smoke tests

## 安装 / Install

```bash
pnpm add @openwx/connectors
```

## 最常见的两种用法 / Two Common Patterns

### 1. 直接作为 `MessageHandler` 使用 / Use as a `MessageHandler`

```ts
import { createBot } from "@openwx/bot";
import { createOpenRouterHandler } from "@openwx/connectors";

const bot = createBot({
  onMessage: createOpenRouterHandler({
    apiKey: process.env.OPENROUTER_API_KEY!,
    model: "openai/gpt-4.1-mini"
  })
});
```

### 2. 作为 hub connector 使用 / Use as a hub connector

```ts
import { defineHubConfig } from "@openwx/hub";

const config = defineHubConfig({
  routes: [{ prefix: "/router", handler: "openrouter" }]
});
```

## 自定义 chatbot 的 HTTP 协议 / HTTP Contract for Custom Apps

如果你的应用已经有 HTTP 服务，推荐优先使用 `createHttpProxyHandler()`。

If your app already exposes HTTP, start with `createHttpProxyHandler()`.

请求体示例：

```json
{
  "conversationId": "wechat-user-id",
  "text": "用户消息"
}
```

响应体示例：

```json
{
  "text": "应用返回的回复"
}
```

更复杂的媒体字段和选项见源码实现。

See the source implementation for media fields and advanced options.

## 相关文档 / Related Docs

- [根 README](../../README.md)
- [assistant 示例](../../examples/assistant/README.md)
- [multi-app 示例](../../examples/multi-app/README.md)
