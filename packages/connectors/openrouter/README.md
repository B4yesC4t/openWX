# @openwx/connector-openrouter

把 OpenRouter 上的模型接进微信。

Expose OpenRouter-hosted models through WeChat.

## 适合谁 / Who It Is For

- 已有 `OPENROUTER_API_KEY`
- 想快速做单模型微信 chatbot
- 或想在多应用模式里把 OpenRouter 作为一个路由

- anyone with an `OPENROUTER_API_KEY`
- anyone building a quick single-model WeChat chatbot
- anyone using OpenRouter as one route in multi-app mode

## 安装 / Install

```bash
pnpm add @openwx/connector-openrouter
```

## API

```ts
interface OpenRouterConnectorOptions {
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  endpoint?: string;
  timeout?: number;
  siteUrl?: string;
  siteName?: string;
  headers?: Record<string, string>;
}

function createOpenRouterConnector(
  options?: OpenRouterConnectorOptions
): Connector;
function createHandler(options?: OpenRouterConnectorOptions): MessageHandler;
```

## 更推荐的入口 / Preferred Entry

如果目标是终端用户直接使用，优先走 [`examples/assistant`](../../../examples/assistant/README.md) 的 `OpenRouter` 模式。
如果只是做一个最小示例，也可以用 [`examples/openrouter-chatbot`](../../../examples/openrouter-chatbot/README.md)。

For end-user-facing flows, start with `OpenRouter` mode in [`examples/assistant`](../../../examples/assistant/README.md).
For a minimal example, see [`examples/openrouter-chatbot`](../../../examples/openrouter-chatbot/README.md).
