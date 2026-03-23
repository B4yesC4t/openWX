# @openwx/connector-codex

Connector for routing openWX messages to the local Codex CLI.

## Install

```bash
pnpm add @openwx/connector-codex
```

## API

```ts
interface CodexConnectorOptions {
  systemPrompt?: string;
  model?: string;
  timeout?: number;
  cliPath?: string;
  cwd?: string;
  sandbox?: "read-only" | "workspace-write" | "danger-full-access";
  profile?: string;
  skipGitRepoCheck?: boolean;
}

function createCodexConnector(
  options?: CodexConnectorOptions
): Connector;
function createHandler(options?: CodexConnectorOptions): MessageHandler;
```

## Example

```ts
import { createCodexConnector } from "@openwx/connector-codex";

const connector = createCodexConnector({
  cwd: process.cwd(),
  sandbox: "read-only"
});
```
