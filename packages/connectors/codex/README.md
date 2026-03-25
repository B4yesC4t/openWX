# @openwx/connector-codex

把本机 `codex` CLI 接进微信。

Expose the local `codex` CLI through WeChat.

## 适合谁 / Who It Is For

- 用户本机已经能运行 `codex`
- 希望把 Codex 作为单应用接入微信
- 或希望在多应用模式里把 Codex 作为一个路由

- anyone whose machine can already run `codex`
- single-app Codex integrations
- multi-app setups where Codex is one route among several

## 安装 / Install

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

## 更推荐的入口 / Preferred Entry

如果目标是终端用户直接使用，优先走 [`examples/assistant`](../../../examples/assistant/README.md) 的 `Codex` 模式。
如果目标是多应用路由，优先看 [`examples/multi-app`](../../../examples/multi-app/README.md)。

For end-user-facing flows, start with `Codex` mode in [`examples/assistant`](../../../examples/assistant/README.md).
For multi-app routing, start with [`examples/multi-app`](../../../examples/multi-app/README.md).
