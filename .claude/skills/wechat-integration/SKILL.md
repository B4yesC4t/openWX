---
name: wechat-integration
description: 引导开发者把现有项目通过 openWX 接入微信。Use when the user mentions 微信, WeChat, 接入微信, 微信 bot, 微信机器人, openWX, or wants to connect an app or coding agent to WeChat.
---

# WeChat Integration Skill

目标：让用户用最少的自然语言交互，把当前项目或现有服务接入微信，并且始终基于 openWX 当前源码生成方案，而不是依赖过时的静态片段。

## 使用边界

- 适用于全新 Node 项目、现有 Node 项目、以及 Python/Go/Java 等已有 HTTP 服务。
- 优先做增量接入：先跑通文本消息，再按需补充命令路由、媒体、多用户、部署。
- 不要凭记忆硬写 openWX API。每次生成代码前都重新读取仓库源码。

## 第一步：读取 openWX 当前实现

在提出实现方案或写代码前，必须按下面顺序读取源码：

1. 先读 [DEVELOPMENT.md](../../../DEVELOPMENT.md)，至少覆盖协议、架构、关键坑点、测试策略。
2. 再读核心入口：
   - [packages/bot/src/create-bot.ts](../../../packages/bot/src/create-bot.ts)
   - [packages/bot/src/handler.ts](../../../packages/bot/src/handler.ts)
   - [packages/core/src/client.ts](../../../packages/core/src/client.ts)
   - [packages/hub/src/config.ts](../../../packages/hub/src/config.ts)
   - [packages/connectors/claude-code/src/index.ts](../../../packages/connectors/claude-code/src/index.ts)
   - [packages/connectors/http-proxy/src/index.ts](../../../packages/connectors/http-proxy/src/index.ts)
3. 最后读场景示例：
   - [examples/minimal/index.ts](../../../examples/minimal/index.ts)
   - [examples/media-bot/index.ts](../../../examples/media-bot/index.ts)
   - [examples/multi-app/index.ts](../../../examples/multi-app/index.ts)
   - [examples/multi-app/hub.yaml](../../../examples/multi-app/hub.yaml)

如果当前工作区不是 openWX 仓库：

1. 先查当前项目是否已经安装 `@openwx/*` 依赖。
2. 若未安装，优先在临时目录克隆 `openWX` 仓库再读取上述文件。
3. 只有在源码不可访问时才停止，并明确说明阻塞原因。

## 第二步：做前置检查

在开始提问前，先自行检查并记录：

- Node.js 是否为 20 或以上。
- 当前项目使用的包管理器：`pnpm`、`npm`、`yarn` 或非 Node 技术栈。
- 是否已有 `package.json`、现成的 `build` / `test` / `lint` 脚本。
- 是否已有 HTTP API、worker 或 webhook 服务可以复用。
- 网络是否可用于安装 npm 依赖与访问 openWX 仓库。
- 项目是否需要把 Node sidecar 放在子目录中，避免打扰现有主工程。

如果用户是非 Node 项目，默认推荐“保留原主项目 + 增加一个 Node sidecar”方案，通过 HTTP Proxy 连接到现有服务。

## 第三步：主动提问

先一次性问完必问项；如果上下文很清楚，也可以顺手给出推荐答案：

1. 接入模式：简单 Bot，还是多应用路由 Hub？
2. 后端选择：Claude Code、HTTP Proxy、还是自定义 `onMessage` / `commands` handler？
3. 是否需要多用户独立上下文或多会话隔离？
4. 是否需要收发图片、视频、文件或语音？

然后根据场景继续追问这些可选项：

- QR 码展示方式：终端打印、本地保存文件、还是上传图床。
- 部署方式：本地开发、服务器常驻、还是 Docker。
- 是否需要命令路由，如 `/help`、`/ai`、`/echo`。
- 是否需要自定义 system prompt 或固定人设。
- 持久化目录用默认值还是自定义路径。
- 对 HTTP Proxy 场景，现有服务的语言、路由地址、认证方式、超时要求是什么。

## 第四步：根据回答做技术决策

使用以下决策原则：

- 纯聊天 Bot，优先用 `@openwx/bot` 的 `createBot()` 和 `onMessage`。
- 需要 `/ai`、`/echo`、多入口分发时，优先用 Hub 风格配置和 `hub.yaml`。
- 需要直接接 Claude Code，优先参考 `createClaudeCodeHandler()`。
- 用户已有 Python / Go / Java / Ruby 服务，或想复用既有 HTTP API 时，优先用 `createHttpProxyHandler()`。
- 用户只想最短路径跑通时，先做文本回复；媒体、多用户、命令路由放到第二轮。
- 当用户要“一个微信号接多个应用”时，必须切到 Hub 方案，不要用单一 `onMessage` 硬拼。

## 第五步：执行规则

每个阶段都遵循“询问 -> 执行 -> 验证”。

### A. 生成依赖安装方案

根据目标场景安装最少依赖：

- 简单 Bot：`@openwx/bot`，以及项目已有运行时需要的 `dotenv`、`tsx` 等。
- AI 助手 Bot：`@openwx/bot` + `@openwx/connectors`，必要时补 `@openwx/connector-claude-code`。
- Hub 路由：`@openwx/bot` + `@openwx/hub` + `@openwx/connectors` + `yaml`。
- HTTP Proxy sidecar：`@openwx/bot` + `@openwx/connectors`，并把代理目标配置到 `${endpoint}/chat`。

始终复用用户当前项目的包管理器，不要无故切换。

### B. 生成最小可运行代码

按场景生成这些文件：

- Bot 入口文件：TypeScript 优先，只有现有项目明确是 JavaScript 时才生成 `.js`。
- `.env.example`：包含 token、持久化目录、Hub 或 HTTP Proxy 所需变量。
- `hub.yaml`：仅在 Hub 模式下生成。
- `package.json` scripts：至少包含 `dev` 和 `start`，必要时补 `build`。
- 若用户已有 HTTP API，生成 HTTP Proxy 连接器配置，并保持与现有服务路由契约一致。

生成代码时遵守这些准则：

- 优先从 openWX 示例改写，不要凭空发明 API。
- 简单 Bot 从 `examples/minimal` 起步。
- 媒体能力从 `examples/media-bot` 起步。
- 多应用路由从 `examples/multi-app` 和 `packages/hub/src/config.ts` 起步。
- HTTP Proxy 请求体和响应体必须按 `packages/connectors/http-proxy/src/index.ts` 当前实现对齐。
- Claude Code handler 的 system prompt、model、timeout 以 `packages/connectors/claude-code/src/index.ts` 当前参数为准。

### C. 为不同技术栈生成落地结构

如果用户项目本身就是 Node：

- 优先直接在现有项目中新增 `src/wechat/`、`bot/` 或用户指定目录。
- 尽量复用现有 TypeScript 配置和脚本。

如果用户项目不是 Node：

- 在仓库内创建独立 `openwx-bot/` 或 `wechat-sidecar/` 目录。
- sidecar 只负责微信收发和 HTTP Proxy 桥接。
- 不要改动用户现有主服务的构建系统。

### D. 生成验证路径

每一步完成后都要验证：

1. 依赖安装后，确认 lockfile 和包管理器状态正常。
2. 代码生成后，运行当前项目对应的 `build`、`test`、`lint`。
3. 若项目没有测试脚本，至少运行 TypeScript 编译或最小 smoke test。
4. 启动 Bot 之后，确认二维码能展示或输出可访问地址。
5. 对 HTTP Proxy，额外检查 `${endpoint}/chat` 能正确返回预期 JSON。

如果失败：

1. 先阅读报错和源码，不要立刻重写。
2. 优先修正路径、导入、脚本和环境变量。
3. 重新执行失败的验证，直到通过或确认真实阻塞。

## 第六步：必须记住的协议约束

在解释或生成代码时，始终复核这些关键点：

- 回复消息时必须带上最新的 `context_token`。
- `get_updates_buf` 必须持久化并在重启后恢复。
- `X-WECHAT-UIN` 必须是 `base64(String(randomUint32()))`。
- `aes_key` 可能是 `base64(raw)` 或 `base64(hex-string)` 两种格式。
- `errcode = -14` 代表 session 过期，需要暂停一小时再重试。
- `bot_type` 固定为 `"3"`。

如果用户遇到扫码成功但收不到回复、重启后重复回历史消息、媒体解密失败等问题，先回到 [troubleshooting.md](troubleshooting.md) 做排查。

## 第七步：交付结果

交付时至少包含：

- 用户选择的接入模式和原因。
- 已安装的 openWX 包列表。
- 新增或修改的入口文件、配置文件、环境变量文件、脚本。
- 已执行的验证命令与结果。
- 当前版本先支持什么，后续增量增强从哪里继续。

交付总结要明确写出：

- 文本消息是否已跑通。
- 命令路由是否已配置。
- 媒体能力是否已接入。
- 多用户上下文是否已隔离。
- HTTP Proxy 或 Claude Code connector 是否已连通。

## 场景参考

- 纯聊天 Bot、AI 助手 Bot、现有 HTTP 服务接入的完整对话样例见 [examples.md](examples.md)。
- 常见故障、协议坑点和排查顺序见 [troubleshooting.md](troubleshooting.md)。
