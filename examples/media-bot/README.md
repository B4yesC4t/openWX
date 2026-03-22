# Media Bot Example

媒体 Bot 示例覆盖图片下载、尺寸读取、图片发送和文件发送，是 `@openwx/bot` 媒体能力的完整最小项目。

## 功能说明

- 收到图片消息后下载并解密图片，读取尺寸，回复 `收到 {w}x{h} 的图片`
- 发送 `/cat` 时回传本地猫图
- 发送 `/readme` 时回传当前示例目录的 `README.md`
- 通过 `ctx.media.download()`、`replyImage()`、`replyFile()` 展示 CDN 下载与上传闭环

## 前置条件

- Node.js 20 及以上
- npm 10 及以上
- 仓库根目录已执行过 `pnpm install`
- 一个可扫码登录的微信账号

## 安装步骤

```bash
cd examples/media-bot
npm install
cp .env.example .env
```

## 运行方法

```bash
npm start
```

## 体验方法

1. 给 Bot 发送一张图片，期待回复 `收到 800x600 的图片` 这类尺寸说明。
2. 发送 `/cat`，期待收到本地 `assets/cat.svg`。
3. 发送 `/readme`，期待收到本示例 README 文件。

## 预期输出

- 终端显示二维码或恢复登录信息
- 处理图片时终端不会额外报错，微信中收到尺寸回复
- 执行 `/cat` 和 `/readme` 时微信分别收到图片和文件消息

## 文件说明

- [index.ts](./index.ts): Bot 入口与命令处理
- [src/image-summary.ts](./src/image-summary.ts): 图片尺寸解析辅助函数
- [src/assets.ts](./src/assets.ts): 本地示例资源路径
