# @openwx/connector-http-proxy

Connector scaffold for forwarding requests to an HTTP service.

## Install

```bash
pnpm add @openwx/connector-http-proxy
```

## API

```ts
interface HttpProxyConnectorOptions {
  url: string;
}

function createHttpProxyConnector(
  options: HttpProxyConnectorOptions
): Connector;
```

## Example

```ts
import { createHttpProxyConnector } from "@openwx/connector-http-proxy";

const connector = createHttpProxyConnector({
  url: "https://example.internal/agent"
});
```
