# openWX Examples

示例目录提供从最简上手到组合能力的完整项目，每个子目录都带有独立的 `README.md`、`.env.example`、`package.json` 和 TypeScript 校验脚本。

## Quick Start

1. 在仓库根目录执行 `pnpm install` 安装共享依赖。
2. 进入任意示例目录，例如 `cd examples/minimal`。
3. 复制环境模板：`cp .env.example .env`，按需填写 token、白名单或其他配置。
4. 执行 `npm install && npm start` 启动示例；需要类型校验时执行 `npx tsc --noEmit`。
5. 微信扫码登录后，按各示例 README 中的步骤发送消息验证结果。

## Example Index

| 名称 | 描述 | 难度 | 使用的 SDK 层 |
| --- | --- | --- | --- |
| [minimal](./minimal/README.md) | 最短路径展示 `createBot()`、消息处理和 `start()` 生命周期。 | 入门 | `@openwx/bot` |
| [media-bot](./media-bot/README.md) | 演示图片下载解密、尺寸读取、本地图片发送和文件发送。 | 中级 | `@openwx/bot`, `@openwx/core` |
| [multi-app](./multi-app/README.md) | 使用 `hub.yaml` 描述多应用路由，并在 Bot 中按前缀分发到不同 connector。 | 中级 | `@openwx/bot`, `@openwx/hub`, `@openwx/connectors` |
| [desktop-agent](./desktop-agent/README.md) | 展示微信远控桌面、白名单保护、危险命令确认和截图回传。 | 高级 | `@openwx/bot`, `@openwx/core` |

## Validation

- 根目录验证：`pnpm build && pnpm test && pnpm lint`
- 单示例验证：
  - `cd examples/minimal && npm install && npx tsc --noEmit`
  - `cd examples/media-bot && npm install && npx tsc --noEmit`
  - `cd examples/multi-app && npm install && npx tsc --noEmit`
  - `cd examples/desktop-agent && npm install && npx tsc --noEmit`
