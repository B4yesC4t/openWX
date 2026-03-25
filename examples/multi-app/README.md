# Multi-App Example

`multi-app` 是 openWX 的高级模式示例。它把多个 agent / app 挂在同一个微信入口下，通过前缀路由把消息分发给不同处理器。

`multi-app` is the advanced mode example for openWX. Multiple agents or apps share one WeChat entry, and prefixes route messages to the correct handler.

## 内置路由 / Built-In Routes

- `/claude <问题>`
- `/codex <问题>`
- `/router <问题>`
- `/echo <文本>`

- `/claude <prompt>`
- `/codex <prompt>`
- `/router <prompt>`
- `/echo <text>`

## 什么时候用它 / When to Use It

- 你需要同时接多个 AI 应用
- 你想把多个内部系统挂在一个微信入口下
- 你接受“通过前缀区分应用”的交互方式

- when multiple AI apps need to share one WeChat entry
- when several internal tools should be reachable from one WeChat bot
- when prefix-based routing is acceptable

如果你只接一个应用，请优先使用 [`assistant`](../assistant)；单应用模式下直接聊天的体验更好。

If you only need one app, use [`assistant`](../assistant) first; direct chat is the better UX for single-app mode.

## 运行方式 / Run

```bash
pnpm install
pnpm --filter @openwx/example-multi-app start
```

## 在微信里怎么试 / What to Send in WeChat

- `/claude 用一句话介绍 openWX`
- `/codex 用一句话介绍 openWX`
- `/router 用一句话介绍 openWX`
- `/echo hello`

- `/claude introduce openWX in one sentence`
- `/codex introduce openWX in one sentence`
- `/router introduce openWX in one sentence`
- `/echo hello`

默认行为：

- `Claude`、`Codex`、`Echo` 默认可用
- 会在首次启动时询问是否提供 OpenRouter key
- 没有登录态时会自动生成二维码 PNG 并尝试打开

Default behavior:

- `Claude`, `Codex`, and `Echo` are available by default
- OpenRouter is optionally enabled on first run
- if no login session exists, a QR PNG is generated and opened

## 扩展方式 / How to Extend

这个示例适合改造成：

- 多个 AI agent 的统一入口
- 多个业务系统的统一消息网关
- 内部工具集合的微信工作台

This example is a good starting point for:

- a shared entry point for multiple AI agents
- a message gateway for multiple business systems
- a WeChat workbench for internal tools

路由逻辑在 [`index.ts`](./index.ts) 及 `src/` 目录下，新增 handler 后即可继续扩展。

The routing logic lives in [`index.ts`](./index.ts) and `src/`; add handlers there to extend it further.
