# Assistant Example

`assistant` 是 openWX 面向终端用户的默认入口。目标不是让用户理解 token、hub 或 connector，而是让用户先选自己要接入的应用类型，然后扫码即可开始用微信。

`assistant` is the default end-user entry for openWX. The goal is not to expose tokens, hubs, or connectors first, but to let users choose what they want to connect and start with a QR scan.

## 支持的接入方式 / Supported Modes

- `Claude`
- `Codex`
- `OpenRouter`
- `自定义 chatbot`
- `多应用接入`

- `Claude`
- `Codex`
- `OpenRouter`
- `Custom chatbot`
- `Multi-app`

默认行为：

- 单应用模式直接聊天，不需要任何前缀。
- `多应用接入` 模式才使用 `/claude`、`/codex`、`/router`、`/echo`。
- 首次没有登录态时会自动生成二维码 PNG，并尝试自动打开。

Default behavior:

- Single-app modes use direct chat, no prefix required.
- `Multi-app` mode uses `/claude`, `/codex`, `/router`, and `/echo`.
- If no login session exists, a QR PNG is generated and opened automatically.

## 运行方式 / Run

```bash
pnpm install
pnpm --filter @openwx/example-assistant start
```

## 你在微信里会怎么用 / How You Use It in WeChat

- 选 `Claude` 后：直接发消息给 Claude
- 选 `Codex` 后：直接发消息给 Codex
- 选 `OpenRouter` 后：直接发消息给 OpenRouter 模型
- 选 `自定义 chatbot` 后：直接发消息给你的 HTTP 应用
- 选 `多应用接入` 后：使用 `/claude`、`/codex`、`/router`、`/echo`

- choose `Claude`: chat directly with Claude
- choose `Codex`: chat directly with Codex
- choose `OpenRouter`: chat directly with the OpenRouter model
- choose `Custom chatbot`: chat directly with your HTTP app
- choose `Multi-app`: use `/claude`, `/codex`, `/router`, `/echo`

## 首次启动流程 / First-Run Flow

1. 程序提示选择接入方式。
2. 如果选择 `OpenRouter`，会提示输入 API key。
3. 如果选择 `自定义 chatbot`，会提示输入 HTTP endpoint。
4. 如果本地没有微信登录态，会自动生成二维码图片并打开。
5. 扫码后，用户就可以在微信里直接开始聊天。

1. The program asks which integration mode to use.
2. `OpenRouter` prompts for an API key.
3. `Custom chatbot` prompts for an HTTP endpoint.
4. If no WeChat session exists locally, a QR image is generated and opened.
5. After scanning, the user can chat directly in WeChat.

## 适合谁 / Who This Is For

- 想把 `Claude` 或 `Codex` 直接接进微信的人
- 想把 OpenRouter 模型接进微信的人
- 已经有自己 chatbot / app 的人
- 希望给终端用户一个“扫码即用”的产品入口的人

- anyone who wants to expose `Claude` or `Codex` through WeChat
- anyone who wants to use an OpenRouter model from WeChat
- anyone who already has a custom chatbot or app
- teams building a scan-and-use product entry for end users

## 配置持久化 / Persisted Configuration

首次选择结果会保存到本地。后续启动会直接沿用上一次的模式和配置。

The chosen mode and related config are persisted locally and reused on later starts.

如果需要强制覆盖，也可以通过环境变量传入：

You can also override behavior with environment variables:

- `OPENWX_PROVIDER`
- `OPENROUTER_API_KEY`
- `OPENWX_TOKEN`
- `CUSTOM_CHATBOT_ENDPOINT`

## 自定义 chatbot 的协议 / Custom Chatbot Contract

如果你接入的是自己的 HTTP 应用，推荐通过 `自定义 chatbot` 模式接入。你的服务只需要提供一个 endpoint，openWX 会把微信消息转成标准 JSON 请求。

If you are connecting your own HTTP app, use `Custom chatbot`. Your service only needs to expose one endpoint; openWX converts WeChat messages into a simple JSON payload.

更详细说明见 [`@openwx/connectors`](../../packages/connectors/README.md)。

See [`@openwx/connectors`](../../packages/connectors/README.md) for details.

如果你只是想尽快把自己的应用接进微信，也可以直接看 [Connect Your App](../../docs/connect-your-app.md)。

If you only want to connect your own app quickly, see [Connect Your App](../../docs/connect-your-app.md).
