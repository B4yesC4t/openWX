# Minimal Bot Example

最简 Bot 示例只做一件事：启动 `createBot()`，收到消息后原样回复。

## 功能说明

- 展示 `createBot()`、`onMessage` 和 `bot.start()` 的最短链路
- 默认回复收到的文本；空消息时给出固定提示
- 适合第一次验证扫码登录、轮询收消息和文本回复

## 前置条件

- Node.js 20 及以上
- npm 10 及以上
- 仓库根目录已执行过 `pnpm install`
- 一个可扫码登录的微信账号

## 安装步骤

```bash
cd examples/minimal
npm install
cp .env.example .env
```

`OPENWX_TOKEN` 可选；不填时会走扫码登录流程。

## 运行方法

```bash
npm start
```

## 预期输出

- 终端展示二维码或已恢复的账号信息
- 微信向 Bot 发送 `hello`
- Bot 回复 `Echo: hello`

## 关键代码

- [index.ts](./index.ts): 10 行以内的最简可运行示例
