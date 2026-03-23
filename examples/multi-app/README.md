# Multi App Routing Example

多应用示例使用 `hub.yaml` 描述路由规则，再由 Bot 在运行时按前缀把消息分发给不同 connector。

## 功能说明

- `/claude` 前缀路由到 Claude Code connector
- `/codex` 前缀路由到 Codex connector
- `/router` 前缀路由到 OpenRouter connector
- `/echo` 前缀路由到 Echo connector
- 未匹配前缀时返回帮助信息
- 启动时读取 `hub.yaml`，通过 `@openwx/hub` 校验配置并输出路由摘要
- 首次运行若未缓存微信登录态，会自动生成二维码 PNG 并用系统默认图片查看器打开
- 首次运行可直接粘贴 OpenRouter API Key；留空则先跳过，`/router` 会返回配置提示

## 前置条件

- Node.js 20 及以上
- npm 10 及以上
- 仓库根目录已执行过 `pnpm install`
- 一个可扫码登录的微信账号
- 若要体验 `/claude`，本机需安装可执行的 `claude` CLI；否则会返回 connector 的降级提示
- 若要体验 `/codex`，本机需安装可执行的 `codex` CLI；否则会返回 connector 的降级提示
- 若要体验 `/router`，可在启动时输入 OpenRouter API Key，或预先配置 `OPENROUTER_API_KEY`

## 安装步骤

```bash
cd examples/multi-app
npm install
```

## 运行方法

```bash
npm start
```

首次启动流程：

1. 终端会询问是否提供 OpenRouter API Key，可直接粘贴，也可回车跳过
2. 如果当前没有已保存的微信登录态，程序会生成二维码图片并自动打开
3. 用微信扫码确认后，登录态会自动保存在本机，后续再次启动一般无需再扫码

## 体验方法

1. 发送 `/echo hello`，期待先看到 typing，再收到 `hello`
2. 发送 `/claude 用一句话介绍 openWX`，期待收到 Claude Code connector 的回答或降级提示
3. 发送 `/codex 帮我解释这个仓库是做什么的`，期待收到 Codex connector 的回答或降级提示
4. 配好 OpenRouter key 后发送 `/router 用一句话介绍 openWX`，期待收到 OpenRouter 回复
5. 发送普通文本，期待收到帮助信息

## 预期输出

- 终端打印 `Hub example ready with 4 routes.`
- 若首次登录，会自动打开二维码 PNG
- 微信按前缀收到不同 downstream handler 的回复

## 文件说明

- [hub.yaml](./hub.yaml): 路由配置
- [index.ts](./index.ts): Bot 入口与 runtime dispatcher
- [src/config.ts](./src/config.ts): YAML 读取与配置校验
- [src/router.ts](./src/router.ts): 路由匹配与帮助文案
