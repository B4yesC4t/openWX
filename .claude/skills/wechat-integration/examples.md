# Example Dialogues

## 场景一：纯聊天 Bot

**用户**：我想接入微信，先做一个最简单的聊天 Bot。  
**Agent**：我会先读取 openWX 的当前源码和示例，再用最小方案接入。请确认四件事：  
1. 用简单 Bot 还是多应用 Hub？  
2. 用自定义 `onMessage` 还是 Claude Code / HTTP Proxy？  
3. 是否需要多用户独立上下文？  
4. 是否需要图片、视频、文件能力？  
**用户**：简单 Bot，自定义 `onMessage`，暂时不用多用户，也不需要媒体。  
**Agent**：我会按 `examples/minimal/index.ts` 的模式生成一个 TypeScript 入口，安装 `@openwx/bot`，补 `.env.example` 和 `dev`/`start` 脚本，然后执行构建验证。  
**用户**：可以。  
**Agent**：已生成最小 Bot，`build` 通过。启动后会展示二维码；扫码并向 Bot 发送 `hello` 时，应该收到文本回复。

## 场景二：AI 助手 Bot

**用户**：我想做一个微信里的 AI 助手，走 Claude Code。  
**Agent**：我先确认几个选项：  
1. 单应用还是 Hub 路由？  
2. 是否需要 `/ai`、`/help` 这类命令？  
3. 是否需要记住每个用户各自的上下文？  
4. 是否需要图片或文件能力？  
**用户**：单应用，支持 `/ai` 和 `/help`，每个用户独立上下文，先不做媒体。  
**Agent**：我会参考 `packages/connectors/claude-code/src/index.ts` 和 `examples/multi-app/index.ts`。方案是安装 `@openwx/bot` 与 `@openwx/connectors`，生成命令路由和 Claude Code handler，并在 `.env.example` 中暴露模型和 prompt 配置。  
**用户**：继续。  
**Agent**：已完成脚手架并通过 `build`。当前默认保留对话历史，`/help` 会展示命令说明，`/ai` 会把消息转发给 Claude Code connector。

## 场景三：现有 HTTP 服务接入

**用户**：我的主项目是 Go API，想把现有 `/chat` 服务接到微信。  
**Agent**：我会采用 Node sidecar + HTTP Proxy。请补充：  
1. 现有服务的基地址是什么？  
2. 是否需要鉴权 header？  
3. 是否要求 webhook 模式先秒回“已收到”？  
4. 是否需要把图片、文件也透传给现有服务？  
**用户**：地址是 `http://localhost:8080`，需要 `Authorization`，先同步等待响应，图片也要透传。  
**Agent**：我会在仓库里新增一个独立 `wechat-sidecar/` 目录，按 `packages/connectors/http-proxy/src/index.ts` 的契约把请求发到 `http://localhost:8080/chat`，并生成环境变量和启动脚本。  
**用户**：好。  
**Agent**：sidecar 已生成并通过构建。当前微信文本会转发到现有 `/chat`，图片会转成 data URL 一起透传；如果上游返回媒体 URL，我也会回传给微信用户。
