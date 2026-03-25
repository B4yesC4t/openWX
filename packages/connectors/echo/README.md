# @openwx/connector-echo

最小回声 connector，用来做联调、冒烟测试和最短链路验证。

The minimal echo connector for smoke tests, routing checks, and shortest-path validation.

## 安装 / Install

```bash
pnpm add @openwx/connector-echo
```

## API

```ts
function createEchoConnector(): Connector;
function createHandler(): MessageHandler;
```

## 什么时候用它 / When to Use It

- 先验证微信收发链路是否通
- 验证 hub 路由是否命中
- 调试时先排除外部 AI 服务问题

- validate the basic WeChat request/response path
- verify hub routing
- isolate issues before involving external AI services
