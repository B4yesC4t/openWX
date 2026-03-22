# @openwx/connector-claude-code

Connector scaffold for Claude Code style request handling.

## Install

```bash
pnpm add @openwx/connector-claude-code
```

## API

```ts
interface ClaudeCodeConnectorOptions {
  systemPrompt?: string;
}

function createClaudeCodeConnector(
  options?: ClaudeCodeConnectorOptions
): Connector;
```

## Example

```ts
import { createClaudeCodeConnector } from "@openwx/connector-claude-code";

const connector = createClaudeCodeConnector({
  systemPrompt: "You are an operations assistant"
});
```
