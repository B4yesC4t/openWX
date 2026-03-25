# Documentation 文档总览

如果你不确定该从哪里看，按这个顺序即可。

If you are not sure where to start, follow this order.

## 面向普通用户 / For Regular Users

1. 看 [README](../README.md)
2. 跑 [assistant 示例](../examples/assistant/README.md)
3. 如果你已有自己的 HTTP app，再看 [Connect Your App](./connect-your-app.md)

1. Read the [README](../README.md)
2. Run the [assistant example](../examples/assistant/README.md)
3. If you already have your own HTTP app, read [Connect Your App](./connect-your-app.md)

## 面向开发者 / For Developers

1. 先看 [examples/README.md](../examples/README.md)
2. 单应用优先看 [@openwx/bot](../packages/bot/README.md)
3. 多应用看 [@openwx/hub](../packages/hub/README.md)
4. 已有 HTTP 服务看 [@openwx/connectors](../packages/connectors/README.md)
5. 需要底层控制时再看 [@openwx/core](../packages/core/README.md)

1. Start with [examples/README.md](../examples/README.md)
2. For a single app, read [@openwx/bot](../packages/bot/README.md)
3. For multi-app routing, read [@openwx/hub](../packages/hub/README.md)
4. For existing HTTP services, read [@openwx/connectors](../packages/connectors/README.md)
5. Read [@openwx/core](../packages/core/README.md) only when you need lower-level control

## 常见入口 / Common Entry Points

- 只想尽快用起来：[`examples/assistant`](../examples/assistant)
- 想接多个 agent：[`examples/multi-app`](../examples/multi-app)
- 想验证最短链路：[`examples/minimal`](../examples/minimal)
- 想接自己的应用：[`docs/connect-your-app.md`](./connect-your-app.md)

- just want to use it quickly: [`examples/assistant`](../examples/assistant)
- want multiple agents: [`examples/multi-app`](../examples/multi-app)
- want the shortest validation path: [`examples/minimal`](../examples/minimal)
- want to connect your own app: [`docs/connect-your-app.md`](./connect-your-app.md)
