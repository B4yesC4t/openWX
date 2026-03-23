# Assistant Example

这是面向终端用户的默认入口。首次启动时，用户只需要选择一种接入方式，然后扫码登录微信即可开始使用。

## 首次启动可选项

1. `Claude`
2. `Codex`
3. `OpenRouter`
4. `自定义 chatbot`
5. `多应用接入`

说明：

- 选择 `Claude` / `Codex` / `OpenRouter` / `自定义 chatbot` 时，微信里直接发消息即可，不需要前缀。
- 只有选择 `多应用接入` 时，才使用 `/claude`、`/codex`、`/router`、`/echo` 这些前缀。

## 功能说明

- 首次运行会交互式选择接入方式，并把选择结果保存在本机
- 没有微信登录态时，自动生成二维码 PNG，并调用系统默认图片查看器打开
- 默认开启 typing
- 支持持久化 OpenRouter key 或自定义 chatbot endpoint

## 前置条件

- Node.js 20 及以上
- 仓库根目录已执行过 `pnpm install`
- 若选择 `Claude`，本机需安装并可执行 `claude`
- 若选择 `Codex`，本机需安装并可执行 `codex`
- 若选择 `OpenRouter`，首次启动时会提示输入 API Key
- 若选择 `自定义 chatbot`，首次启动时会提示输入 HTTP endpoint

## 运行方法

```bash
pnpm --filter @openwx/example-assistant start
```

## 首次运行流程

1. 选择接入方式
2. 如有需要，输入 OpenRouter API Key 或自定义 chatbot endpoint
3. 若当前没有微信登录态，程序会自动打开二维码图片
4. 微信扫码确认后即可开始使用

## 文件说明

- [index.ts](./index.ts): 统一入口
- [src/setup.ts](./src/setup.ts): 首次安装向导与本地配置持久化
- [src/runtime.ts](./src/runtime.ts): 单 Agent / 多应用运行逻辑
