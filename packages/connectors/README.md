# openWX Connectors

The `packages/connectors/` directory contains adapter-style entry points that turn inbound openWX requests into downstream application calls.

## Packages

- [`@openwx/connector-echo`](./echo/README.md): returns the inbound text with an `Echo:` prefix
- [`@openwx/connector-http-proxy`](./http-proxy/README.md): placeholder connector for HTTP upstream routing
- [`@openwx/connector-claude-code`](./claude-code/README.md): placeholder connector for Claude Code style flows

## Shared Contract

Connector packages implement the `Connector` interface from `@openwx/core`:

```ts
interface Connector {
  id: string;
  handle(request: ConnectorRequest): Promise<ConnectorResponse>;
}
```

Use the connector that matches your downstream integration pattern, or copy one as the starting point for a new connector package.
