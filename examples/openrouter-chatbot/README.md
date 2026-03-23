# OpenRouter Chatbot Example

这个示例把微信消息接到 OpenRouter，形成一个最小可运行聊天机器人。

## 功能说明

- 通过 `@openwx/connector-openrouter` 把文本消息转发到 OpenRouter
- 支持扫码登录或直接使用 `OPENWX_TOKEN`
- 适合作为 OpenRouter chatbot 的最小 case

## 前置条件

- Node.js 20 及以上
- 仓库根目录已执行过 `pnpm install`
- `OPENROUTER_API_KEY` 已配置

## 安装步骤

```bash
cd examples/openrouter-chatbot
npm install
cp .env.example .env
```

## 运行方法

```bash
npm start
```

## 体验方法

1. 给 Bot 发送普通文本
2. 期待收到 OpenRouter 返回的文本回复

## 文件说明

- [index.ts](./index.ts): Bot 入口
