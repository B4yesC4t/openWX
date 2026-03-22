# Desktop Agent Example

桌面 Agent 示例把微信消息映射到本地桌面操作，重点展示白名单保护、危险命令确认和媒体回传。

## 功能说明

- `/ls [path]` 列出工作目录内的文件
- `/screenshot` 截取当前桌面并以图片形式回传
- `/exec <command>` 执行本地命令；命中危险模式时要求先 `/confirm`
- 仅响应白名单用户，未授权用户的消息直接忽略

## 前置条件

- Node.js 20 及以上
- npm 10 及以上
- 仓库根目录已执行过 `pnpm install`
- 一个可扫码登录的微信账号
- `OPENWX_ALLOWED_USERS` 已配置白名单
- macOS 需要自带 `screencapture`；Linux 需要安装 ImageMagick 的 `import`

## 安装步骤

```bash
cd examples/desktop-agent
npm install
cp .env.example .env
```

## 运行方法

```bash
npm start
```

## 体验方法

1. 白名单用户发送 `/ls`
2. 白名单用户发送 `/screenshot`
3. 白名单用户发送 `/exec pwd`
4. 白名单用户发送危险命令，例如 `/exec rm -rf tmp`，Bot 会要求先发送 `/confirm`

## 预期输出

- 未授权用户没有任何回复
- `/ls` 返回目录列表
- `/screenshot` 返回桌面截图
- 危险命令必须先确认，避免误操作

## 文件说明

- [index.ts](./index.ts): Bot 入口与命令编排
- [src/security.ts](./src/security.ts): 白名单、危险命令和路径限制
- [src/system.ts](./src/system.ts): 本地系统操作封装
