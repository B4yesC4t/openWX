# @openwx/connector-echo

Minimal connector that echoes inbound text.

## Install

```bash
pnpm add @openwx/connector-echo
```

## API

```ts
function createEchoConnector(): Connector;
function createHandler(): MessageHandler;
```

## Example

```ts
import { createEchoConnector } from "@openwx/connector-echo";

const connector = createEchoConnector();
const response = await connector.handle({
  conversationId: "demo",
  text: "hello"
});
```
