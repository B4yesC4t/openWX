# @openwx/connector-openrouter

OpenRouter-based chatbot connector for openWX.

## Install

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

## Example

```ts
import { createOpenRouterConnector } from "@openwx/connector-openrouter";

const connector = createOpenRouterConnector({
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "openai/gpt-5.2"
});
```
