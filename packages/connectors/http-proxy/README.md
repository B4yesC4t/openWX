# @openwx/connector-http-proxy

Connector scaffold for forwarding requests to an HTTP service.

## Install

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

## Example

```ts
import { createHttpProxyConnector } from "@openwx/connector-http-proxy";

const connector = createHttpProxyConnector({
  endpoint: "https://example.internal/agent"
});
```
