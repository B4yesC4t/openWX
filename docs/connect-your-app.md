# Connect Your App 把你的应用接入微信

这份文档回答一个问题：如果你已经有自己的应用，应该怎么用 openWX 把它接进微信。

This guide answers one question: if you already have your own app, how should you connect it to WeChat with openWX.

## 先判断你的应用类型 / First Identify Your App Type

### 1. Claude Code

如果用户机器上已经能运行 `claude`，最简单的方式就是直接用 `assistant -> Claude`。

If the user's machine can already run `claude`, the simplest path is `assistant -> Claude`.

### 2. Codex

如果用户机器上已经能运行 `codex`，最简单的方式就是直接用 `assistant -> Codex`。

If the user's machine can already run `codex`, the simplest path is `assistant -> Codex`.

### 3. OpenRouter

如果你有 `OPENROUTER_API_KEY`，直接用 `assistant -> OpenRouter`。

If you have `OPENROUTER_API_KEY`, use `assistant -> OpenRouter`.

### 4. 你自己的 chatbot 或 HTTP 服务

这是最常见的企业接入方式。直接用 `assistant -> 自定义 chatbot`，填你的 endpoint。

This is the most common enterprise integration path. Use `assistant -> Custom chatbot` and enter your endpoint.

### 5. 多个应用

如果你要把多个 agent / app 接到同一个微信入口，使用 `assistant -> 多应用接入` 或 `examples/multi-app`。

If multiple agents or apps should share one WeChat entry, use `assistant -> Multi-app` or `examples/multi-app`.

## 最简单的接入方式 / Easiest Integration Path

```bash
pnpm install
pnpm --filter @openwx/example-assistant start
```

然后：

1. 选择应用类型
2. 如果是 `OpenRouter`，输入 API key
3. 如果是 `自定义 chatbot`，输入 HTTP endpoint
4. 扫码登录微信
5. 开始在微信里使用你的应用

Then:

1. Choose the app type
2. Enter an API key if using `OpenRouter`
3. Enter an HTTP endpoint if using `Custom chatbot`
4. Scan the WeChat QR code
5. Start using your app from WeChat

## 如果你的应用是 HTTP 服务 / If Your App Is an HTTP Service

优先走 `http-proxy` 方案，因为这是成本最低、最稳定、最容易维护的路径。

Prefer the `http-proxy` path because it is the lowest-friction, most stable, and easiest to maintain.

典型请求：

```json
{
  "conversationId": "wechat-user-id",
  "text": "用户消息"
}
```

典型响应：

```json
{
  "text": "你的应用回复"
}
```

更完整说明见 [@openwx/connectors](../packages/connectors/README.md)。

See [@openwx/connectors](../packages/connectors/README.md) for details.

## 如果你的应用不是 HTTP 服务 / If Your App Is Not an HTTP Service

你有两种常见做法：

- 先包一层 HTTP adapter，再走 `自定义 chatbot`
- 参考现有 connector，写一个本地 connector

You have two common options:

- wrap it with an HTTP adapter and use `Custom chatbot`
- build a local connector based on the existing ones

## 什么时候需要 multi-app / When You Need Multi-App

只有当一个微信入口要同时接多个应用时，才需要 `multi-app`。  
如果只接一个应用，直接聊天的体验更好。

Use `multi-app` only when one WeChat entry must handle multiple apps.  
If you only connect one app, direct chat provides a better UX.
