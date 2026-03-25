# Minimal Bot Example

这是 openWX 的最小可运行示例。它只做一件事：收到消息后原样回复，用来验证微信登录、轮询和文本回复链路是否正常。

This is the smallest runnable openWX example. It simply echoes incoming messages so you can validate login, polling, and text replies.

## 运行 / Run

```bash
pnpm install
pnpm --filter @openwx/example-minimal start
```

## 在微信里怎么试 / What to Send in WeChat

给 Bot 发 `hello`，预期会收到原样回声。

Send `hello` to the bot and expect an echoed reply.

## 适合谁 / Who It Is For

- 第一次接触 openWX 的开发者
- 想先验证微信链路是否正常的人
- 想在最短代码路径上理解 `createBot()` 的人

- developers new to openWX
- anyone validating the WeChat path first
- anyone who wants to understand `createBot()` with minimal code
