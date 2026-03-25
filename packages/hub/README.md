# @openwx/hub

`@openwx/hub` 是 openWX 的多应用路由层。它解决的问题不是“怎么接入微信”，而是“已经能接入微信以后，怎么把多个应用挂在同一个微信入口下”。

`@openwx/hub` is the multi-app routing layer in openWX. It solves a different problem: not how to connect to WeChat, but how to run multiple apps behind one WeChat entry once you already can.

## 适合谁 / Who Should Use It

- 你要同时接多个 AI agent
- 你要把多个内部应用统一挂到一个微信入口
- 你接受 prefix-based routing，例如 `/claude`、`/codex`

- use it when multiple AI agents must share one WeChat entry
- use it when several internal apps should be exposed through one bot
- use it when prefix-based routing is acceptable, such as `/claude` and `/codex`

## 安装 / Install

```bash
pnpm add @openwx/hub
```

## 最小示例 / Minimal Example

```ts
import { defineHubConfig, createRouter } from "@openwx/hub";

const hub = defineHubConfig({
  routes: [
    { prefix: "/claude", handler: "claude-code" },
    { prefix: "/codex", handler: "codex" }
  ]
});

const router = createRouter(hub);
```

## 核心概念 / Core Concepts

- `defineHubConfig()`: 定义路由配置
- `createRouter()`: 根据消息文本做匹配
- `createHub()` / runtime: 加载 connector 并运行

- `defineHubConfig()`: define routing config
- `createRouter()`: match based on message text
- `createHub()` / runtime: load connectors and run them

## 什么时候不该先用它 / When Not to Start Here

如果你只接一个应用，不要默认先上 hub。
先用 `assistant` 的单应用模式或直接用 `@openwx/bot`。

If you only need one app, do not start with hub by default.
Use single-app mode in `assistant` or build directly on `@openwx/bot` first.

## 相关文档 / Related Docs

- [根 README](../../README.md)
- [assistant 示例](../../examples/assistant/README.md)
- [multi-app 示例](../../examples/multi-app/README.md)
