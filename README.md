# openWX

[![CI](https://github.com/b4yes/openWX/actions/workflows/ci.yml/badge.svg)](https://github.com/b4yes/openWX/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@openwx/core)](https://www.npmjs.com/package/@openwx/core)

**把任何应用直接接入微信**
**Connect any app directly to WeChat**

openWX 是一个面向 TypeScript / Node.js 的微信接入开源项目。它把微信登录、消息收发、媒体处理、Bot 生命周期、多应用路由这些能力封装起来，让你可以把 AI agent、本地 CLI、自建 chatbot、HTTP 服务、普通业务应用，直接接进微信。

openWX is an open-source WeChat integration stack for TypeScript / Node.js. It wraps login, messaging, media, bot lifecycle, and routing so AI agents, local CLIs, custom chatbots, HTTP services, and standard business apps can be used from WeChat.

## 三步开始 / Start in 3 Steps

```bash
pnpm install
pnpm --filter @openwx/example-assistant start
```

然后：

1. 选择你要接入的应用类型
2. 扫码登录微信
3. 直接在微信里开始聊天

Then:

1. Choose what you want to connect
2. Scan the WeChat QR code
3. Start chatting in WeChat

## 你可以接什么 / What You Can Connect

- `Claude`
- `Codex`
- `OpenRouter`
- `你自己的 chatbot / HTTP 服务`
- `多个应用一起接入`

- `Claude`
- `Codex`
- `OpenRouter`
- `your own chatbot / HTTP service`
- `multiple apps together`

## 该选哪种方式 / Which Path Should You Choose

| 你的情况 | 推荐入口 | 用户体验 |
| --- | --- | --- |
| 只接 Claude | `assistant -> Claude` | 直接聊天 |
| 只接 Codex | `assistant -> Codex` | 直接聊天 |
| 只接 OpenRouter | `assistant -> OpenRouter` | 直接聊天 |
| 你已经有 HTTP app / chatbot | `assistant -> 自定义 chatbot` | 直接聊天 |
| 想把多个 agent / app 接到一个微信入口 | `assistant -> 多应用接入` 或 `examples/multi-app` | 前缀路由 |
| 想完全自己控制协议、消息和生命周期 | `@openwx/core` / `@openwx/bot` | 开发者模式 |

| Your situation | Recommended entry | UX |
| --- | --- | --- |
| Connect only Claude | `assistant -> Claude` | direct chat |
| Connect only Codex | `assistant -> Codex` | direct chat |
| Connect only OpenRouter | `assistant -> OpenRouter` | direct chat |
| You already have an HTTP app / chatbot | `assistant -> Custom chatbot` | direct chat |
| Connect multiple agents / apps to one WeChat entry | `assistant -> Multi-app` or `examples/multi-app` | prefix routing |
| Full control over protocol and lifecycle | `@openwx/core` / `@openwx/bot` | developer mode |

## 默认推荐入口 / Recommended Default Entry

[`examples/assistant`](./examples/assistant) 是默认推荐入口。

- 首次启动不要求先知道 `OPENWX_TOKEN`
- 会自动生成二维码图片并尝试打开
- 单应用模式直接聊天，不需要前缀
- 只有“多应用接入”才需要 `/claude`、`/codex`、`/router`

[`examples/assistant`](./examples/assistant) is the default entry.

- no need to know `OPENWX_TOKEN` first
- generates and opens a QR image automatically
- single-app modes use direct chat
- only `Multi-app` mode requires `/claude`, `/codex`, `/router`

## Examples

| 示例 | 用途 | 启动命令 |
| --- | --- | --- |
| [`assistant`](./examples/assistant) | 默认产品入口，扫码即用 | `pnpm --filter @openwx/example-assistant start` |
| [`multi-app`](./examples/multi-app) | 同时接多个应用 | `pnpm --filter @openwx/example-multi-app start` |
| [`minimal`](./examples/minimal) | 最小 Bot 示例 | `pnpm --filter @openwx/example-minimal start` |
| [`openrouter-chatbot`](./examples/openrouter-chatbot) | 单模型 OpenRouter chatbot | `pnpm --filter @openwx/example-openrouter-chatbot start` |
| [`media-bot`](./examples/media-bot) | 图片 / 文件能力示例 | `pnpm --filter @openwx/example-media-bot start` |
| [`desktop-agent`](./examples/desktop-agent) | 桌面自动化 / 本地 agent | `pnpm --filter @openwx/example-desktop-agent start` |

| Example | Purpose | Command |
| --- | --- | --- |
| [`assistant`](./examples/assistant) | default product entry | `pnpm --filter @openwx/example-assistant start` |
| [`multi-app`](./examples/multi-app) | connect multiple apps | `pnpm --filter @openwx/example-multi-app start` |
| [`minimal`](./examples/minimal) | smallest bot example | `pnpm --filter @openwx/example-minimal start` |
| [`openrouter-chatbot`](./examples/openrouter-chatbot) | single-model OpenRouter chatbot | `pnpm --filter @openwx/example-openrouter-chatbot start` |
| [`media-bot`](./examples/media-bot) | image and file workflows | `pnpm --filter @openwx/example-media-bot start` |
| [`desktop-agent`](./examples/desktop-agent) | desktop automation / local agent | `pnpm --filter @openwx/example-desktop-agent start` |

更详细的示例说明见 [examples/README.md](./examples/README.md)。

See [examples/README.md](./examples/README.md) for detailed example guidance.

## 文档 / Docs

- [文档总览 / Documentation Guide](./docs/README.md)
- [把你的应用接入微信 / Connect Your App](./docs/connect-your-app.md)
- [Examples](./examples/README.md)
- [Core SDK](./packages/core/README.md)
- [Bot](./packages/bot/README.md)
- [Hub](./packages/hub/README.md)
- [Connectors](./packages/connectors/README.md)

## 给终端用户的结论 / For End Users

如果你只是想把一个现成应用接到微信，不需要先理解 SDK、Hub 或 Connector。
直接运行 `assistant`，选应用类型，扫码，然后开始用。

If you only want to connect an existing app to WeChat, you do not need to learn the SDK, hub, or connector model first.
Run `assistant`, choose the app type, scan the QR code, and start using it.

## 给开发者的结论 / For Developers

- 单应用：优先 `@openwx/bot`
- 多应用：再加 `@openwx/hub`
- 已有 HTTP 服务：优先 `http-proxy`
- 本地 CLI / agent：参考现成 connector

- single app: start with `@openwx/bot`
- multi-app: add `@openwx/hub`
- existing HTTP service: start with `http-proxy`
- local CLI / agent: follow the built-in connectors

## License

MIT
