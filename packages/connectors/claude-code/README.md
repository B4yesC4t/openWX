# @openwx/connector-claude-code

把本机 `claude` CLI 接进微信。

Expose the local `claude` CLI through WeChat.

## 适合谁 / Who It Is For

- 用户本机已经能运行 `claude`
- 希望把 Claude Code 作为单应用接入微信
- 或希望在多应用模式里把 Claude 作为一个路由

- anyone whose machine can already run `claude`
- single-app Claude integrations
- multi-app setups where Claude is one route among several

## 安装 / Install

```bash
pnpm add @openwx/connector-claude-code
```

## API

```ts
interface ClaudeCodeConnectorOptions {
  systemPrompt?: string;
  model?: string;
  timeout?: number;
  cliPath?: string;
}

function createClaudeCodeConnector(
  options?: ClaudeCodeConnectorOptions
): Connector;
function createHandler(options?: ClaudeCodeConnectorOptions): MessageHandler;
```

## 更推荐的入口 / Preferred Entry

如果目标是终端用户直接使用，优先走 [`examples/assistant`](../../../examples/assistant/README.md) 的 `Claude` 模式。
如果目标是多应用路由，优先看 [`examples/multi-app`](../../../examples/multi-app/README.md)。

For end-user-facing flows, start with `Claude` mode in [`examples/assistant`](../../../examples/assistant/README.md).
For multi-app routing, start with [`examples/multi-app`](../../../examples/multi-app/README.md).
