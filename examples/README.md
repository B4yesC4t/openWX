# Examples 示例

这里是 openWX 的可运行示例。建议先从 `assistant` 开始，再按需要看别的示例。

This directory contains runnable examples for openWX. Start with `assistant`, then move to other examples as needed.

## 先看这个 / Start Here

### [`assistant`](./assistant)

默认推荐入口，适合大多数用户。

- 先选 `Claude`、`Codex`、`OpenRouter`、`自定义 chatbot` 或 `多应用接入`
- 扫码登录
- 单应用直接聊天，多应用才使用前缀

Recommended default entry for most users.

- choose `Claude`, `Codex`, `OpenRouter`, `Custom chatbot`, or `Multi-app`
- scan the QR code
- single-app modes chat directly; multi-app uses prefixes

```bash
pnpm --filter @openwx/example-assistant start
```

## 其他示例 / Other Examples

| 示例 | 适合谁 | 你会验证什么 | 启动命令 |
| --- | --- | --- | --- |
| [`multi-app`](./multi-app) | 需要同时接多个应用的人 | `/claude`、`/codex`、`/router`、`/echo` 路由 | `pnpm --filter @openwx/example-multi-app start` |
| [`minimal`](./minimal) | 第一次验证微信链路的开发者 | 最基础的收消息和回消息 | `pnpm --filter @openwx/example-minimal start` |
| [`openrouter-chatbot`](./openrouter-chatbot) | 想单独接 OpenRouter 的开发者 | 单模型对话 | `pnpm --filter @openwx/example-openrouter-chatbot start` |
| [`media-bot`](./media-bot) | 需要图片和文件能力的人 | 图片下载、图片回复、文件发送 | `pnpm --filter @openwx/example-media-bot start` |
| [`desktop-agent`](./desktop-agent) | 需要本地自动化能力的人 | 截图、命令执行、白名单控制 | `pnpm --filter @openwx/example-desktop-agent start` |

| Example | Best for | What it validates | Command |
| --- | --- | --- | --- |
| [`multi-app`](./multi-app) | multi-app users | prefix routing with `/claude`, `/codex`, `/router`, `/echo` | `pnpm --filter @openwx/example-multi-app start` |
| [`minimal`](./minimal) | first-time developers | basic receive-and-reply flow | `pnpm --filter @openwx/example-minimal start` |
| [`openrouter-chatbot`](./openrouter-chatbot) | OpenRouter users | single-model chat | `pnpm --filter @openwx/example-openrouter-chatbot start` |
| [`media-bot`](./media-bot) | media-heavy apps | image download, image reply, file sending | `pnpm --filter @openwx/example-media-bot start` |
| [`desktop-agent`](./desktop-agent) | local automation users | screenshots, command execution, allowlists | `pnpm --filter @openwx/example-desktop-agent start` |

## 推荐顺序 / Recommended Order

1. 先跑 [`assistant`](./assistant)
2. 如果你已有 HTTP 服务，直接在 `assistant` 里选 `自定义 chatbot`
3. 如果你要接多个应用，再看 [`multi-app`](./multi-app)
4. 如果你要自己写功能，再看 `packages/` 下的 README

1. Run [`assistant`](./assistant) first
2. If you already have an HTTP service, choose `Custom chatbot` inside `assistant`
3. Move to [`multi-app`](./multi-app) only when multiple apps share one bot
4. Read the package READMEs when you need custom development
