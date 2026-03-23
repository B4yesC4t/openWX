# openWX Connectors

The `packages/connectors/` directory contains adapter-style entry points that turn inbound openWX requests into downstream application calls.

## Packages

- [`@openwx/connector-echo`](./echo/README.md): returns the inbound text with an `Echo:` prefix
- [`@openwx/connector-http-proxy`](./http-proxy/README.md): forwards messages to an upstream HTTP chatbot
- [`@openwx/connector-claude-code`](./claude-code/README.md): routes messages to the local Claude Code CLI
- [`@openwx/connector-codex`](./codex/README.md): routes messages to the local Codex CLI
- [`@openwx/connector-openrouter`](./openrouter/README.md): routes messages to the OpenRouter chat API

## Shared Contract

Connector packages implement the `Connector` interface from `@openwx/core`
through `create*Connector()` factories:

```ts
interface Connector {
  id: string;
  handle(request: ConnectorRequest): Promise<ConnectorResponse>;
}
```

Use the connector that matches your downstream integration pattern, or copy one as the starting point for a new connector package.

Most connector packages also expose `createHandler()` helpers for manual wiring
inside `createBot()` examples.
