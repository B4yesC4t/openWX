# @openwx/connector-http-proxy

这是“把任何应用接入微信”最通用的 connector。只要你的应用能提供一个 HTTP endpoint，openWX 就可以把微信消息转发给它。

This is the most general-purpose connector for the idea of "connect any app to WeChat." If your app can expose an HTTP endpoint, openWX can forward WeChat messages to it.

## 适合谁 / Who It Is For

- 已有 chatbot 服务
- 已有业务系统 API
- 想用最少成本把自己的应用接进微信

- existing chatbot services
- existing internal or business APIs
- anyone who wants the lowest-friction path to connect an app to WeChat

## 安装 / Install

```bash
pnpm add @openwx/connector-http-proxy
```

## API

```ts
interface HttpProxyConnectorOptions {
  endpoint: string;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  webhook?: boolean;
}

function createHttpProxyConnector(
  options: HttpProxyConnectorOptions
): Connector;
function createHandler(options: HttpProxyConnectorOptions): MessageHandler;
```

## 最重要的接入建议 / Most Important Recommendation

如果你自己的应用已经有 HTTP 服务，不要先写新 connector。
优先用这个包，或者直接通过 [`examples/assistant`](../../../examples/assistant/README.md) 里的 `自定义 chatbot` 模式接入。

If your app already exposes HTTP, do not start by writing a new connector.
Use this package first, or connect it through `Custom chatbot` mode in [`examples/assistant`](../../../examples/assistant/README.md).
