# OpenRouter Chatbot Example

这个示例展示如何把 OpenRouter 上的模型直接接进微信。

This example shows how to expose an OpenRouter model directly through WeChat.

## 运行 / Run

```bash
export OPENROUTER_API_KEY=your_key
pnpm install
pnpm --filter @openwx/example-openrouter-chatbot start
```

## 在微信里怎么试 / What to Send in WeChat

直接发送普通文本即可。

Send a normal text message directly.

## 适合谁 / Who It Is For

- 想做单模型 chatbot 的开发者
- 不需要多应用路由，只想把一个模型接进微信的人

- developers building a single-model chatbot
- anyone who only wants one model exposed through WeChat

## 更推荐的产品入口 / Preferred Product Entry

如果目标是交给终端用户使用，更推荐 [`assistant`](../assistant)，因为它支持首启选择模式、扫码登录和更完整的产品化流程。

If the goal is an end-user-facing product entry, prefer [`assistant`](../assistant), which includes first-run mode selection, QR login, and a more complete onboarding flow.
