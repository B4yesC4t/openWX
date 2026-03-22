# Multi App Routing Example

多应用示例使用 `hub.yaml` 描述路由规则，再由 Bot 在运行时按前缀把消息分发给不同 connector。

## 功能说明

- `/ai` 前缀路由到 Claude Code connector
- `/echo` 前缀路由到 Echo connector
- 未匹配前缀时返回帮助信息
- 启动时读取 `hub.yaml`，通过 `@openwx/hub` 校验配置并输出路由摘要

## 前置条件

- Node.js 20 及以上
- npm 10 及以上
- 仓库根目录已执行过 `pnpm install`
- 一个可扫码登录的微信账号
- 若要体验 `/ai`，本机需安装可执行的 `claude` CLI；否则会返回 connector 的降级提示

## 安装步骤

```bash
cd examples/multi-app
npm install
cp .env.example .env
```

## 运行方法

```bash
npm start
```

## 体验方法

1. 发送 `/echo hello`，期待收到 `hello`
2. 发送 `/ai 用一句话介绍 openWX`，期待收到 Claude Code connector 的回答或降级提示
3. 发送普通文本，期待收到帮助信息

## 预期输出

- 终端打印 `Hub example ready with 2 routes.`
- 微信按前缀收到不同 downstream handler 的回复

## 文件说明

- [hub.yaml](./hub.yaml): 路由配置
- [index.ts](./index.ts): Bot 入口与 runtime dispatcher
- [src/config.ts](./src/config.ts): YAML 读取与配置校验
- [src/router.ts](./src/router.ts): 路由匹配与帮助文案
