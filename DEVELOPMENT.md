# openWX 开发文档

> 本文档是 openWX 项目的完整开发参考，涵盖 iLink 协议规范、参考实现分析、项目架构设计、各层实现指南、测试验证方案。目标：研发人员阅读此文档后，能独立完成开发和验证。

---

## 目录

1. [项目概述](#1-项目概述)
2. [iLink 协议完整规范](#2-ilink-协议完整规范)
3. [参考实现分析](#3-参考实现分析)
4. [项目架构](#4-项目架构)
5. [各层实现指南](#5-各层实现指南)
6. [关键坑点与注意事项](#6-关键坑点与注意事项)
7. [测试与验证方案](#7-测试与验证方案)
8. [开发环境搭建](#8-开发环境搭建)
9. [附录：完整类型定义](#9-附录完整类型定义)

---

## 1. 项目概述

### 1.1 什么是 openWX

openWX 是一个开源 SDK，让任何应用或 Agent 通过腾讯官方 iLink Bot API 接入微信。不依赖任何第三方框架，MIT 许可证。

### 1.2 核心能力

- 扫码登录微信 Bot 账号
- 收发文本/图片/视频/文件/语音消息
- 长轮询消息监听
- 多应用路由（一个微信账号对接多个后端服务）
- 媒体文件 CDN 加密上传/下载

### 1.3 项目分层

```
protocol/          # 协议文档（本文档的第 2 章即为协议规范）
packages/
  core/            # 基础能力：auth, polling, send, media, session
  bot/             # 开发者框架：简化 API + 生命周期管理
  hub/             # 路由服务：多 app 路由 + Web UI
  connectors/      # 预制连接器：claude-code, codex, echo 等
examples/          # 示例代码
```

### 1.4 面向用户

| 用户类型 | 使用层 | 场景 |
|---------|--------|------|
| 底层开发者 | core | 需要完全控制协议细节 |
| 应用开发者 | bot | 3 行代码起一个 bot |
| 平台运营者 | hub | 一个微信绑定多个应用，Web UI 管理 |
| 终端用户 | connectors | 开箱即用，选一个连接器直接跑 |

---

## 2. iLink 协议完整规范

### 2.1 基础信息

| 项目 | 值 |
|------|-----|
| API 基地址 | `https://ilinkai.weixin.qq.com` |
| CDN 基地址 | `https://novac2c.cdn.weixin.qq.com/c2c` |
| 协议格式 | HTTP/JSON, 全部 POST（除 get_bot_qrcode 和 get_qrcode_status 为 GET） |
| 认证方式 | Bearer Token |
| bot_type | 固定值 `"3"`（含义未知，但必须使用此值） |

### 2.2 认证头

每个请求必须携带以下 HTTP 头:

```
Content-Type: application/json
AuthorizationType: ilink_bot_token
Authorization: Bearer {bot_token}        // POST 请求必须
X-WECHAT-UIN: {base64(String(randomUint32()))}  // 每次请求随机生成
Content-Length: {body字节长度}
```

**X-WECHAT-UIN 生成逻辑**（极其重要，必须精确实现）:

```javascript
// 1. 生成随机 uint32
const uint32 = crypto.randomBytes(4).readUInt32BE(0);
// 2. 转为十进制字符串
const str = String(uint32);   // 例如 "2847591036"
// 3. 字符串做 base64 编码（注意：是对字符串编码，不是对数字编码）
const uin = Buffer.from(str, "utf-8").toString("base64");
// 例如 "Mjg0NzU5MTAzNg=="
```

**可选头**: `SKRouteTag`（路由标签，从配置文件读取，非必须）

### 2.3 base_info

所有 POST 请求的 body 中都包含 `base_info` 字段:

```json
{
  "base_info": {
    "channel_version": "1.0.0"
  },
  ...其他字段
}
```

### 2.4 七个 API 端点

#### 2.4.1 get_bot_qrcode — 获取登录二维码

```
GET /ilink/bot/get_bot_qrcode?bot_type=3
```

**无需 Authorization 头。**

响应:
```json
{
  "qrcode": "xxx",                    // 二维码标识符（用于轮询状态）
  "qrcode_img_content": "https://..."  // 二维码图片 URL（用于展示给用户扫码）
}
```

#### 2.4.2 get_qrcode_status — 轮询扫码状态

```
GET /ilink/bot/get_qrcode_status?qrcode={qrcode}
```

**需要额外头**: `iLink-App-ClientVersion: 1`

**这是一个长轮询接口**，服务器会 hold 住请求直到状态变化或超时（约 35 秒）。客户端需设置 35 秒 AbortController 超时。

响应:
```json
{
  "status": "wait" | "scaned" | "confirmed" | "expired",
  "bot_token": "...",           // 仅 confirmed 时返回
  "ilink_bot_id": "xxx@im.bot", // 仅 confirmed 时返回，Bot 的 ID
  "baseurl": "https://...",     // 仅 confirmed 时返回（可能与默认不同）
  "ilink_user_id": "xxx@im.wechat"  // 扫码用户的 ID
}
```

**状态流转**:
```
wait → scaned → confirmed    正常流程
wait → expired               二维码过期（约 5 分钟）
```

**二维码过期处理**: 最多刷新 3 次（重新调用 get_bot_qrcode），超过 3 次放弃。

**登录成功后需要保存**:
- `bot_token`: 后续所有 API 调用的认证凭证
- `ilink_bot_id`: Bot 账号 ID（格式 `xxx@im.bot`，存储时需 normalize：`@` → `-`, `.` → `-`）
- `baseurl`: API 基地址（可能不同于默认值）
- `ilink_user_id`: 扫码用户 ID

#### 2.4.3 getupdates — 长轮询获取新消息

```
POST /ilink/bot/getupdates
```

请求:
```json
{
  "get_updates_buf": "",     // 上次返回的游标，首次为空字符串
  "base_info": { "channel_version": "1.0.0" }
}
```

**这是核心的消息接收接口**。服务器会 hold 住请求直到有新消息或超时（默认 35 秒）。

响应:
```json
{
  "ret": 0,                           // 0=成功，非0=错误
  "errcode": 0,                       // 错误码，-14=session过期
  "errmsg": "",
  "msgs": [WeixinMessage, ...],       // 新消息数组
  "get_updates_buf": "...",           // 新游标，必须保存并在下次请求带上
  "longpolling_timeout_ms": 35000     // 服务端建议的下次超时时间
}
```

**关键要点**:
- `get_updates_buf` 必须持久化到磁盘，重启后恢复，否则会收到大量历史消息
- 客户端超时（AbortError）是正常行为，返回空响应继续轮询即可
- `errcode=-14` 表示 session 过期，需要暂停 1 小时后重试

#### 2.4.4 sendmessage — 发送消息

```
POST /ilink/bot/sendmessage
```

请求:
```json
{
  "msg": {
    "from_user_id": "",              // 留空
    "to_user_id": "xxx@im.wechat",   // 目标用户 ID
    "client_id": "unique-id",        // 客户端生成的唯一消息 ID
    "message_type": 2,               // 2=BOT
    "message_state": 2,              // 2=FINISH（完整消息）
    "context_token": "...",          // 必须！从收到的消息中原样回传
    "item_list": [
      { "type": 1, "text_item": { "text": "回复内容" } }
    ]
  },
  "base_info": { "channel_version": "1.0.0" }
}
```

**context_token 是最关键的字段**:
- 每条收到的消息都带有 `context_token`
- 回复时必须把对应用户最新的 `context_token` 原样传回
- 缺少 context_token 会导致消息无法关联到对话，用户看不到回复
- 需要在内存中维护 `Map<userId, contextToken>`，每收到一条消息就更新

**item_list 每条消息只放一个 item**。如果要发文本+图片，需要发两次 sendmessage。

#### 2.4.5 sendtyping — 发送"正在输入"指示

```
POST /ilink/bot/sendtyping
```

请求:
```json
{
  "ilink_user_id": "xxx@im.wechat",
  "typing_ticket": "...",            // 从 getconfig 获取
  "status": 1,                       // 1=正在输入, 2=取消输入
  "base_info": { "channel_version": "1.0.0" }
}
```

typing_ticket 需要先通过 getconfig 获取。每 5 秒发送一次 keepalive。

#### 2.4.6 getconfig — 获取配置

```
POST /ilink/bot/getconfig
```

请求:
```json
{
  "ilink_user_id": "xxx@im.wechat",
  "context_token": "...",
  "base_info": { "channel_version": "1.0.0" }
}
```

响应:
```json
{
  "ret": 0,
  "typing_ticket": "..."    // base64 编码的 typing ticket
}
```

#### 2.4.7 getuploadurl — 获取媒体上传 URL

```
POST /ilink/bot/getuploadurl
```

请求:
```json
{
  "filekey": "random-hex-32",          // 随机生成的文件标识
  "media_type": 1,                     // 1=IMAGE, 2=VIDEO, 3=FILE, 4=VOICE
  "to_user_id": "xxx@im.wechat",
  "rawsize": 12345,                    // 明文文件大小（字节）
  "rawfilemd5": "abcdef...",           // 明文文件 MD5（hex）
  "filesize": 12352,                   // 密文大小（AES-128-ECB PKCS7 对齐后）
  "no_need_thumb": true,               // 是否不需要缩略图
  "aeskey": "0123456789abcdef...",     // AES 密钥（hex 编码，32 字符）
  "base_info": { "channel_version": "1.0.0" }
}
```

响应:
```json
{
  "upload_param": "...",        // 上传加密参数
  "thumb_upload_param": "..."   // 缩略图上传参数（可选）
}
```

### 2.5 CDN 媒体上传/下载

#### 2.5.1 加密方案

所有媒体文件使用 **AES-128-ECB** 加密（PKCS7 填充）:

```javascript
import { createCipheriv, createDecipheriv } from "node:crypto";

// 加密
function encryptAesEcb(plaintext: Buffer, key: Buffer): Buffer {
  const cipher = createCipheriv("aes-128-ecb", key, null);
  return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

// 解密
function decryptAesEcb(ciphertext: Buffer, key: Buffer): Buffer {
  const decipher = createDecipheriv("aes-128-ecb", key, null);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// 密文大小计算（PKCS7 对齐到 16 字节边界）
function aesEcbPaddedSize(plaintextSize: number): number {
  return Math.ceil((plaintextSize + 1) / 16) * 16;
}
```

**密钥**: 随机生成 16 字节，hex 编码后为 32 字符。

#### 2.5.2 上传流程

```
1. 读取文件 → 计算 MD5 → 生成随机 AES key → 计算密文大小
2. 调用 getuploadurl → 获取 upload_param
3. AES-128-ECB 加密文件
4. POST 密文到 CDN:
   URL: {cdnBaseUrl}/upload?encrypted_query_param={upload_param}&filekey={filekey}
   Content-Type: application/octet-stream
   Body: 加密后的二进制数据
5. 从 CDN 响应头读取 x-encrypted-param → 这就是 downloadParam
6. 重试策略: 最多 3 次，4xx 立即失败，5xx 重试
```

#### 2.5.3 下载流程

```
1. 从收到的消息中取出 media.encrypt_query_param 和 media.aes_key
2. 构造下载 URL: {cdnBaseUrl}/download?encrypted_query_param={encrypt_query_param}
3. GET 下载密文
4. AES-128-ECB 解密
```

**aes_key 解析的坑**（极其重要）:

收到的 `aes_key` 是 base64 编码的，但编码内容有两种格式:
- **图片**: `base64(raw 16 bytes)` → base64 解码后直接得到 16 字节 key
- **文件/语音/视频**: `base64(hex string)` → base64 解码后得到 32 字符 hex 字符串，还需要再 hex 解码才得到 16 字节 key

```javascript
function parseAesKey(aesKeyBase64: string): Buffer {
  const decoded = Buffer.from(aesKeyBase64, "base64");
  if (decoded.length === 16) {
    return decoded;  // 直接是 16 字节 raw key
  }
  if (decoded.length === 32 && /^[0-9a-fA-F]{32}$/.test(decoded.toString("ascii"))) {
    return Buffer.from(decoded.toString("ascii"), "hex");  // hex 字符串，需二次解码
  }
  throw new Error(`Invalid aes_key length: ${decoded.length}`);
}
```

#### 2.5.4 发送图片消息

```json
{
  "msg": {
    "to_user_id": "xxx@im.wechat",
    "client_id": "unique-id",
    "message_type": 2,
    "message_state": 2,
    "context_token": "...",
    "item_list": [{
      "type": 2,
      "image_item": {
        "media": {
          "encrypt_query_param": "{uploadBufferToCdn返回的downloadParam}",
          "aes_key": "{base64(aesKeyHex)}",
          "encrypt_type": 1
        },
        "mid_size": 12352
      }
    }]
  }
}
```

#### 2.5.5 发送视频消息

```json
{
  "item_list": [{
    "type": 5,
    "video_item": {
      "media": {
        "encrypt_query_param": "...",
        "aes_key": "...",
        "encrypt_type": 1
      },
      "video_size": 123456
    }
  }]
}
```

#### 2.5.6 发送文件消息

```json
{
  "item_list": [{
    "type": 4,
    "file_item": {
      "media": {
        "encrypt_query_param": "...",
        "aes_key": "...",
        "encrypt_type": 1
      },
      "file_name": "report.pdf",
      "len": "12345"
    }
  }]
}
```

### 2.6 消息类型

| type | 含义 | 对应 item 字段 |
|------|------|---------------|
| 1 | 文本 | `text_item.text` |
| 2 | 图片 | `image_item.media` |
| 3 | 语音 | `voice_item.media` + `voice_item.text`（语音转文字） |
| 4 | 文件 | `file_item.media` + `file_item.file_name` |
| 5 | 视频 | `video_item.media` |

### 2.7 消息方向标识

| 字段 | 值 | 含义 |
|------|-----|------|
| message_type | 1 | USER（用户发来的） |
| message_type | 2 | BOT（Bot 发出的） |
| message_state | 0 | NEW |
| message_state | 1 | GENERATING（流式，正在生成） |
| message_state | 2 | FINISH（完整消息） |

### 2.8 ID 格式

| 类型 | 格式 | 示例 |
|------|------|------|
| Bot ID | `{hex}@im.bot` | `2a8077478451@im.bot` |
| User ID | `{hex}@im.wechat` | `b0f5860fdecb@im.wechat` |
| Normalized ID | `@`→`-`, `.`→`-` | `2a8077478451-im-bot` |

Normalize 逻辑: 将 `@` 替换为 `-`，`.` 替换为 `-`。存储文件名使用 normalized ID。

### 2.9 Session 过期机制

- 服务端返回 `errcode=-14` 或 `ret=-14` 表示 session 过期
- 过期后必须暂停所有 API 调用 **1 小时**
- 1 小时后自动恢复轮询
- 过期原因：同一微信号在其他地方扫码登录了新的 bot（一个微信同时只能绑定一个 bot）
- **没有显式的解绑/登出 API**。解绑是隐式的：新扫码 → 旧 token 失效 → 收到 -14

### 2.10 引用消息

收到的消息可能包含引用（回复某条消息）:

```json
{
  "type": 1,
  "text_item": { "text": "用户的回复文字" },
  "ref_msg": {
    "title": "被引用消息的摘要",
    "message_item": {
      "type": 1,
      "text_item": { "text": "被引用的原文" }
    }
  }
}
```

处理逻辑: 将引用内容拼接到正文前面，格式 `[引用: {title} | {refText}]\n{userText}`。

---

## 3. 参考实现分析

### 3.1 现有三个实现

我们有三个已验证可运行的参考实现:

| 实现 | 路径 | 特点 |
|------|------|------|
| npm-source/plugin-package | 腾讯官方 OpenClaw 插件 | 最完整，含完整媒体处理、OCR、SILK 转码 |
| weixin-agent-sdk | wong2 的解耦 SDK | 清晰的 Agent 接口，无 OpenClaw 依赖 |
| wechat-claude-bridge.mjs | 裸 HTTP 实现 | 最简，341 行实现完整收发流程 |

### 3.2 核心流程提取

#### 3.2.1 登录流程（从 login-qr.ts 提取）

```
startWeixinLoginWithQr()
  1. 调用 GET /ilink/bot/get_bot_qrcode?bot_type=3
  2. 返回 { qrcode, qrcode_img_content }
  3. 展示二维码（终端渲染或输出 URL）

waitForWeixinLogin()
  1. 循环 pollQRStatus()
  2. GET /ilink/bot/get_qrcode_status?qrcode={qrcode}
     - 客户端超时 35 秒（AbortController）
     - 超时返回 { status: "wait" }，继续轮询
  3. 状态处理:
     - wait: 继续轮询
     - scaned: 提示用户在微信确认
     - expired: 刷新二维码（最多 3 次）
     - confirmed: 保存 token，返回成功
  4. 总超时: 480 秒（8 分钟）
```

#### 3.2.2 消息监听循环（从 monitor.ts 提取）

```
monitorLoop()
  let getUpdatesBuf = loadFromDisk() ?? ""
  let consecutiveFailures = 0

  while (!aborted) {
    try {
      resp = POST /ilink/bot/getupdates { get_updates_buf }

      if (resp有API错误) {
        if (errcode === -14) {
          pauseSession(1小时)
          sleep(剩余暂停时间)
          continue
        }
        consecutiveFailures++
        if (consecutiveFailures >= 3) {
          sleep(30秒)   // 退避
        } else {
          sleep(2秒)    // 短重试
        }
        continue
      }

      consecutiveFailures = 0

      if (resp.get_updates_buf) {
        saveToDisk(resp.get_updates_buf)  // 持久化游标
        getUpdatesBuf = resp.get_updates_buf
      }

      if (resp.longpolling_timeout_ms) {
        nextTimeout = resp.longpolling_timeout_ms  // 采纳服务端建议超时
      }

      for (msg of resp.msgs) {
        processOneMessage(msg)
      }
    } catch (err) {
      if (aborted) return
      // 同上 consecutiveFailures 逻辑
    }
  }
```

**关键参数**:
- 长轮询超时: 35 秒（可被服务端 `longpolling_timeout_ms` 覆盖）
- 最大连续失败: 3 次
- 退避延时: 30 秒
- 短重试延时: 2 秒

#### 3.2.3 消息处理流程（从 process-message.ts 和 inbound.ts 提取）

```
processOneMessage(msg)
  1. 提取文本: item_list 中找 type=1 的 text_item.text
     - 语音带转文字: type=3 且 voice_item.text 不为空 → 直接用文字
     - 引用消息: 拼接 [引用: ...]\n{text}

  2. 媒体下载（优先级: 图片 > 视频 > 文件 > 语音）
     - 从 CDN 下载密文
     - AES-128-ECB 解密
     - 保存到本地临时文件

  3. 缓存 context_token
     contextTokenStore.set(`${accountId}:${userId}`, msg.context_token)

  4. 调用 Agent.chat({ conversationId, text, media? })

  5. 发送回复
     - 文本: POST sendmessage，附带 context_token
     - 媒体: 先上传 CDN，再 sendmessage 带 media item
```

#### 3.2.4 发送回复流程（从 send.ts 提取）

```
sendMessageWeixin(to, text, opts)
  1. 检查 contextToken 存在（缺失直接抛错）
  2. 构造 SendMessageReq:
     {
       msg: {
         from_user_id: "",          // 始终留空
         to_user_id: to,
         client_id: generateUUID(),
         message_type: 2,           // BOT
         message_state: 2,          // FINISH
         context_token: token,
         item_list: [{ type: 1, text_item: { text } }]
       }
     }
  3. POST /ilink/bot/sendmessage

发送媒体:
  1. 上传文件到 CDN（见 2.5.2）
  2. 构造对应 type 的 item（image_item / video_item / file_item）
  3. 如果有文本 caption，先发一条文本消息，再发媒体消息
     （每次 sendmessage 的 item_list 只放一个 item）
```

### 3.3 最简可运行实现（87 行，claude-weixin/bot.mjs）

这个实现展示了最小可用的 bot:

```javascript
// 核心就三步:
// 1. 实现 agent.chat() 方法
const agent = {
  async chat(req) {
    const reply = await askClaude(req.text);
    return { text: reply };
  },
};

// 2. 调用 start() 开始监听
start(agent, { accountId: "xxx-im-bot" });

// askClaude() 通过 spawn 子进程调用 claude CLI:
// spawn("/bin/bash", ["-c", "unset CLAUDECODE; claude -p --output-format text"])
// 通过 stdin 传入 prompt，stdout 收集回复
```

### 3.4 裸 HTTP 实现（341 行，wechat-claude-bridge.mjs）

这个实现不依赖任何 SDK，纯 fetch 调用，是理解协议的最佳参考:

```javascript
// 登录
async function login() {
  const qrResp = await apiGet(BASE_URL, `ilink/bot/get_bot_qrcode?bot_type=3`);
  // 轮询状态...
  // confirmed 后保存 { token, baseUrl, accountId, userId } 到 .weixin-token.json
}

// 主循环
while (true) {
  const resp = await getUpdates(baseUrl, token, getUpdatesBuf);
  if (resp.get_updates_buf) getUpdatesBuf = resp.get_updates_buf;
  for (const msg of resp.msgs ?? []) {
    if (msg.message_type !== 1) continue;  // 只处理用户消息
    const text = extractText(msg);
    const reply = await askClaude(text);
    await sendMessage(baseUrl, token, msg.from_user_id, reply, msg.context_token);
  }
}
```

---

## 4. 项目架构

### 4.1 分层依赖图

```
protocol/  (文档，无代码依赖)

  core ──→ bot ──→ hub
                    ↓
                connectors
                    ↓
                examples
```

所有上层包依赖 core，但 core 不依赖任何上层包。

### 4.2 Monorepo 结构

```
openWX/
├── protocol/
│   └── README.md              # 本文档的协议章节独立版本
├── packages/
│   ├── core/                  # @openwx/core
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts       # 公共导出
│   │   │   ├── client.ts      # ILinkClient 主类
│   │   │   ├── auth.ts        # QR 登录流程
│   │   │   ├── polling.ts     # 长轮询消息监听
│   │   │   ├── send.ts        # 发送消息
│   │   │   ├── media.ts       # 媒体上传下载
│   │   │   ├── crypto.ts      # AES-128-ECB
│   │   │   ├── session.ts     # Session 管理（过期、恢复）
│   │   │   ├── store.ts       # 持久化（token, syncbuf）
│   │   │   └── types.ts       # 协议类型定义
│   │   └── tests/
│   ├── bot/                   # @openwx/bot
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── create-bot.ts  # createBot() 入口
│   │   │   ├── handler.ts     # Handler 接口定义
│   │   │   └── lifecycle.ts   # 启动/停止/重连生命周期
│   │   └── tests/
│   ├── hub/                   # @openwx/hub
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── router.ts      # 消息路由
│   │   │   ├── config.ts      # 路由配置
│   │   │   └── web/           # Web UI（后期）
│   │   └── tests/
│   └── connectors/
│       ├── claude-code/       # @openwx/connector-claude-code
│       ├── echo/              # @openwx/connector-echo
│       └── http-proxy/        # @openwx/connector-http-proxy
├── examples/
│   ├── minimal/               # 最简 bot（10 行代码）
│   ├── media-bot/             # 支持图片/文件的 bot
│   ├── multi-app/             # hub 多应用路由
│   └── desktop-agent/         # 桌面 Agent 客户端（微信远控电脑）
├── DEVELOPMENT.md             # 本文档
├── README.md
├── package.json               # workspace root
└── LICENSE                    # MIT
```

### 4.3 npm 包命名

| 包名 | 路径 | 描述 |
|------|------|------|
| `@openwx/core` | packages/core | 协议实现，底层能力 |
| `@openwx/bot` | packages/bot | 开发者框架 |
| `@openwx/hub` | packages/hub | 多应用路由服务 |
| `@openwx/connector-claude-code` | packages/connectors/claude-code | Claude Code 连接器 |
| `@openwx/connector-echo` | packages/connectors/echo | Echo 测试连接器 |
| `@openwx/connector-http-proxy` | packages/connectors/http-proxy | HTTP 代理连接器 |

---

## 5. 各层实现指南

### 5.1 core 层

core 是整个项目的基础。它实现 iLink 协议的所有能力，不包含任何业务逻辑。

#### 5.1.1 ILinkClient 类

```typescript
// packages/core/src/client.ts

export interface ILinkClientOptions {
  baseUrl?: string;              // 默认 https://ilinkai.weixin.qq.com
  cdnBaseUrl?: string;           // 默认 https://novac2c.cdn.weixin.qq.com/c2c
  token?: string;                // Bot token（登录后获取）
  storeDir?: string;             // 持久化目录，默认 ~/.openwx/
}

export class ILinkClient {
  constructor(options?: ILinkClientOptions);

  // 认证
  async login(): Promise<LoginResult>;             // QR 登录
  async getLoginQRCode(): Promise<QRCodeResult>;   // 仅获取二维码
  async waitForScan(qrcode: string): Promise<ScanResult>;  // 仅等待扫码

  // 消息
  async poll(options?: PollOptions): Promise<PollResult>;   // 单次轮询
  async send(to: string, message: OutboundMessage): Promise<void>;
  async sendText(to: string, text: string): Promise<void>;
  async sendImage(to: string, filePath: string): Promise<void>;
  async sendVideo(to: string, filePath: string): Promise<void>;
  async sendFile(to: string, filePath: string, fileName?: string): Promise<void>;

  // 状态
  async sendTyping(to: string): Promise<void>;
  async cancelTyping(to: string): Promise<void>;

  // 媒体
  async uploadMedia(filePath: string, to: string, type: MediaType): Promise<UploadResult>;
  async downloadMedia(media: CDNMedia): Promise<Buffer>;

  // 生命周期
  dispose(): void;
}
```

#### 5.1.2 内部实现要点

**HTTP 层** (client.ts 内部):
- 统一的 `apiFetch()` 方法处理所有 POST 请求
- 自动构建 headers（包括随机 X-WECHAT-UIN）
- AbortController 超时处理
- POST 请求: 15 秒超时
- 长轮询请求: 35 秒超时（可被服务端覆盖）
- 轻量请求（getconfig, sendtyping）: 10 秒超时

**context_token 管理** (内部维护):
```typescript
// 内部 Map，不暴露给用户
private contextTokens = new Map<string, string>();

// 收到消息时自动更新
private onMessage(msg: WeixinMessage) {
  if (msg.context_token && msg.from_user_id) {
    this.contextTokens.set(msg.from_user_id, msg.context_token);
  }
}

// 发送时自动附加
async sendText(to: string, text: string) {
  const contextToken = this.contextTokens.get(to);
  if (!contextToken) {
    throw new Error(`No context_token for user ${to}. Cannot send without receiving a message first.`);
  }
  // ...
}
```

**持久化** (store.ts):
```typescript
// 存储目录结构
// ~/.openwx/
//   accounts/
//     {accountId}.json          # { token, baseUrl, userId, savedAt }
//     {accountId}.sync.json     # { get_updates_buf }
//   accounts.json               # [accountId1, accountId2, ...]

export interface Store {
  saveAccount(id: string, data: AccountData): void;
  loadAccount(id: string): AccountData | null;
  saveSyncBuf(id: string, buf: string): void;
  loadSyncBuf(id: string): string | null;
  listAccounts(): string[];
}
```

**Session 管理** (session.ts):
```typescript
// session 过期后暂停 1 小时
const SESSION_PAUSE_MS = 60 * 60 * 1000;
const SESSION_EXPIRED_CODE = -14;

export class SessionGuard {
  private pauseUntil = new Map<string, number>();

  pause(accountId: string): void;
  isPaused(accountId: string): boolean;
  getRemainingMs(accountId: string): number;
  assertActive(accountId: string): void;  // 抛错如果暂停中
}
```

#### 5.1.3 事件模型

core 层使用 EventEmitter 通知上层:

```typescript
export interface ILinkClientEvents {
  message: (msg: InboundMessage) => void;       // 收到新消息
  connected: (account: AccountInfo) => void;     // 登录成功
  disconnected: (reason: string) => void;        // 断开连接
  sessionExpired: (accountId: string) => void;   // session 过期
  error: (error: Error) => void;                 // 错误
}
```

### 5.2 bot 层

bot 层在 core 之上提供简化的开发者 API。

#### 5.2.1 createBot API

```typescript
// packages/bot/src/create-bot.ts

export interface BotOptions {
  /** 消息处理函数 */
  onMessage: (ctx: MessageContext) => Promise<Reply>;
  /** 账号 ID（可选，默认用已登录的第一个） */
  accountId?: string;
  /** 是否自动登录（默认 true） */
  autoLogin?: boolean;
}

export interface MessageContext {
  /** 发送者 ID */
  from: string;
  /** 文本内容 */
  text: string;
  /** 媒体附件（如果有） */
  media?: {
    type: "image" | "audio" | "video" | "file";
    download(): Promise<Buffer>;     // 下载并解密
    save(path: string): Promise<void>; // 下载并保存到文件
    mimeType: string;
    fileName?: string;
  };
  /** 引用的消息 */
  quoted?: { text: string };
  /** 回复（快捷方式） */
  reply(text: string): Promise<void>;
  replyImage(path: string): Promise<void>;
  replyFile(path: string, name?: string): Promise<void>;
}

export type Reply =
  | string                         // 纯文本
  | { text: string }               // 文本对象
  | { text?: string; image: string }   // 图片（可带文本）
  | { text?: string; file: string; fileName?: string }  // 文件
  | void;                          // 不回复

/**
 * 创建并启动一个 Bot。
 * 阻塞直到 abort 或不可恢复的错误。
 */
export async function createBot(options: BotOptions): Promise<void>;
```

#### 5.2.2 使用示例

```typescript
import { createBot } from "@openwx/bot";

await createBot({
  onMessage: async (ctx) => {
    if (ctx.text === "ping") {
      return "pong";
    }
    if (ctx.media?.type === "image") {
      const buf = await ctx.media.download();
      // 处理图片...
      return "收到图片！";
    }
    return `你说了: ${ctx.text}`;
  },
});
```

#### 5.2.3 生命周期

```
createBot()
  ├─ 检查是否已有 token
  │   ├─ 有: 直接连接
  │   └─ 无 + autoLogin: 启动 QR 登录流程
  ├─ 启动 polling loop
  ├─ 收到消息 → 转换为 MessageContext → 调用 onMessage
  ├─ onMessage 返回 Reply → 自动发送
  ├─ session 过期 → 暂停 1 小时 → 自动恢复
  └─ abort 或致命错误 → 退出
```

### 5.3 hub 层

hub 是一个独立运行的路由服务，支持一个微信账号对接多个后端应用。

#### 5.3.1 路由配置

```typescript
// packages/hub/src/config.ts

export interface HubConfig {
  /** 路由规则，按顺序匹配 */
  routes: Route[];
  /** 默认路由（都不匹配时使用） */
  defaultRoute?: RouteTarget;
}

export interface Route {
  /** 匹配条件 */
  match: {
    /** 前缀匹配（如 "/claude" → 以 /claude 开头的消息路由到指定目标） */
    prefix?: string;
    /** 正则匹配 */
    pattern?: string;
    /** 指定用户 */
    from?: string[];
  };
  /** 路由目标 */
  target: RouteTarget;
  /** 是否去掉匹配的前缀再转发（默认 true） */
  stripPrefix?: boolean;
}

export type RouteTarget =
  | { type: "connector"; name: string; config?: Record<string, unknown> }
  | { type: "http"; url: string; headers?: Record<string, string> }
  | { type: "command"; command: string; args?: string[] };
```

#### 5.3.2 使用示例

```yaml
# hub.config.yaml
routes:
  - match: { prefix: "/claude" }
    target: { type: connector, name: claude-code }
  - match: { prefix: "/gpt" }
    target: { type: http, url: "http://localhost:3000/chat" }
  - match: { prefix: "/echo" }
    target: { type: connector, name: echo }

defaultRoute:
  type: connector
  name: claude-code
```

### 5.4 connectors 层

每个 connector 实现一个标准接口:

```typescript
// 定义在 core 中
export interface Connector {
  /** 处理消息，返回回复 */
  handle(request: ConnectorRequest): Promise<ConnectorResponse>;
  /** 初始化（可选） */
  init?(): Promise<void>;
  /** 清理（可选） */
  dispose?(): void;
}

export interface ConnectorRequest {
  conversationId: string;
  text: string;
  media?: { type: string; filePath: string; mimeType: string };
}

export interface ConnectorResponse {
  text?: string;
  media?: { type: string; url: string; fileName?: string };
}
```

#### 5.4.1 claude-code connector

```typescript
// packages/connectors/claude-code/src/index.ts

import { spawn } from "node:child_process";
import type { Connector, ConnectorRequest, ConnectorResponse } from "@openwx/core";

export function createClaudeCodeConnector(options?: {
  model?: string;
  systemPrompt?: string;
  timeout?: number;
}): Connector {
  return {
    async handle(req: ConnectorRequest): Promise<ConnectorResponse> {
      const prompt = options?.systemPrompt
        ? `${options.systemPrompt}\n\n用户消息：${req.text}`
        : req.text;

      const text = await runClaude(prompt, options?.timeout ?? 60_000);
      return { text };
    },
  };
}

function runClaude(prompt: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn("/bin/bash", [
      "-c",
      "unset CLAUDECODE; claude -p --output-format text",
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      timeout: timeoutMs,
    });

    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.on("close", (code) => {
      resolve(code === 0 && stdout.trim() ? stdout.trim() : "AI 暂时不可用，请稍后再试。");
    });
    child.on("error", () => {
      resolve("AI 暂时不可用，请稍后再试。");
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}
```

#### 5.4.2 echo connector

```typescript
export function createEchoConnector(): Connector {
  return {
    async handle(req) {
      return { text: `Echo: ${req.text}` };
    },
  };
}
```

#### 5.4.3 http-proxy connector

```typescript
export function createHttpProxyConnector(options: {
  url: string;
  headers?: Record<string, string>;
}): Connector {
  return {
    async handle(req) {
      const res = await fetch(options.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...options.headers },
        body: JSON.stringify(req),
      });
      return await res.json();
    },
  };
}
```

---

## 6. 关键坑点与注意事项

### 6.1 最容易踩的坑（按严重程度排序）

#### P0: context_token 丢失

**问题**: 不传 context_token → 消息发出去了但用户看不到，或者关联到错误的对话。

**解决**: 每收到一条消息，立即缓存其 context_token（按 userId 维度）。发送回复时，从缓存中取最新的 context_token。如果没有缓存（从未收到过该用户的消息），拒绝发送并抛错。

```typescript
// 正确做法
const tokenCache = new Map<string, string>();

// 收到消息时
tokenCache.set(msg.from_user_id, msg.context_token);

// 发送时
const ct = tokenCache.get(toUserId);
if (!ct) throw new Error("Cannot reply without context_token");
```

#### P0: get_updates_buf 未持久化

**问题**: 每次重启都从空字符串开始 → 收到大量历史消息 → 疯狂回复历史消息。

**解决**: 每次收到新的 `get_updates_buf`，立即写入文件。启动时从文件恢复。

#### P1: X-WECHAT-UIN 格式错误

**问题**: 直接 base64 编码数字（而非数字的字符串形式）→ 请求被拒绝。

**解决**: 必须是 `base64(String(uint32))`，不是 `base64(uint32bytes)`。

#### P1: AES Key 双重编码

**问题**: 文件/语音/视频的 aes_key 是 `base64(hexString)`，需要两次解码。如果只做一次 base64 解码，得到的是 32 字节的 hex 字符串而非 16 字节密钥 → 解密失败。

**解决**: 参见 2.5.3 节的 `parseAesKey` 函数。

#### P1: 一个微信只能绑定一个 bot

**问题**: 用户以为可以同时运行多个 bot → 第二个 bot 扫码后第一个 bot 收到 -14。

**解决**: 在文档和错误信息中明确说明。Hub 模式解决"一个微信对接多个应用"的需求。

#### P2: item_list 只能放一个 item

**问题**: 想同时发文本和图片，放在同一个 item_list 里 → 可能只有一个被展示。

**解决**: 分两次 sendmessage 发送。先发文本，再发图片。

#### P2: 长轮询超时不是错误

**问题**: getupdates 超时后当作错误处理 → 触发退避逻辑 → 消息延迟增大。

**解决**: 客户端 AbortError 是正常行为，返回空响应直接继续下一轮轮询。

### 6.2 安全注意事项

- Bot token 等同密码，存储时文件权限设为 `0o600`
- 不要在日志中打印完整 token，使用 `redactToken()` 脱敏
- CDN URL 不要暴露给用户（含加密参数）
- 默认存储目录 `~/.openwx/` 不要放在项目仓库内

### 6.3 性能注意事项

- getupdates 是同步循环，一次只处理一个消息。如果 Agent 处理慢，后续消息会排队
- 可以考虑并发处理不同用户的消息（同一用户的消息必须顺序处理以保证 context_token 正确）
- CDN 上传/下载可能较慢（几百毫秒到几秒），媒体处理要做好超时

---

## 7. 测试与验证方案

### 7.1 测试策略概览

```
┌──────────────────────────────────────┐
│        端到端测试 (E2E)               │  真实微信扫码 + 真实消息收发
├──────────────────────────────────────┤
│        集成测试 (Integration)         │  Mock iLink Server + 真实协议流程
├──────────────────────────────────────┤
│        单元测试 (Unit)                │  纯函数，不涉及网络
└──────────────────────────────────────┘
```

### 7.2 单元测试（不需要微信账号）

#### 7.2.1 AES 加密/解密

```typescript
// tests/unit/crypto.test.ts
import { encryptAesEcb, decryptAesEcb, aesEcbPaddedSize } from "../src/crypto";

test("encrypt then decrypt roundtrip", () => {
  const key = Buffer.from("0123456789abcdef");  // 16 bytes
  const plain = Buffer.from("Hello, WeChat!");
  const cipher = encryptAesEcb(plain, key);
  const decrypted = decryptAesEcb(cipher, key);
  expect(decrypted.toString()).toBe("Hello, WeChat!");
});

test("padded size calculation", () => {
  expect(aesEcbPaddedSize(0)).toBe(16);    // 空文件也有 padding
  expect(aesEcbPaddedSize(15)).toBe(16);
  expect(aesEcbPaddedSize(16)).toBe(32);   // 刚好 16 字节时，padding 多 16
  expect(aesEcbPaddedSize(17)).toBe(32);
});

test("aes_key parsing - raw 16 bytes", () => {
  const raw = crypto.randomBytes(16);
  const b64 = raw.toString("base64");
  const parsed = parseAesKey(b64);
  expect(parsed).toEqual(raw);
});

test("aes_key parsing - hex string in base64", () => {
  const raw = crypto.randomBytes(16);
  const hex = raw.toString("hex");  // 32 chars
  const b64 = Buffer.from(hex, "ascii").toString("base64");
  const parsed = parseAesKey(b64);
  expect(parsed).toEqual(raw);
});
```

#### 7.2.2 X-WECHAT-UIN 生成

```typescript
test("X-WECHAT-UIN format", () => {
  const uin = randomWechatUin();
  // 解码后应该是一个纯数字字符串
  const decoded = Buffer.from(uin, "base64").toString("utf-8");
  expect(/^\d+$/.test(decoded)).toBe(true);
  // 数字范围: 0 ~ 4294967295 (uint32)
  const num = parseInt(decoded, 10);
  expect(num).toBeGreaterThanOrEqual(0);
  expect(num).toBeLessThanOrEqual(4294967295);
});
```

#### 7.2.3 消息解析

```typescript
test("extract text from item_list", () => {
  const msg = {
    item_list: [{ type: 1, text_item: { text: "hello" } }],
  };
  expect(extractText(msg)).toBe("hello");
});

test("extract voice transcription", () => {
  const msg = {
    item_list: [{ type: 3, voice_item: { text: "语音内容" } }],
  };
  expect(extractText(msg)).toBe("语音内容");
});

test("extract quoted message", () => {
  const msg = {
    item_list: [{
      type: 1,
      text_item: { text: "我的回复" },
      ref_msg: { title: "原始消息摘要" },
    }],
  };
  expect(extractText(msg)).toBe("[引用: 原始消息摘要]\n我的回复");
});

test("context token caching", () => {
  setContextToken("acc1", "user1", "token-abc");
  expect(getContextToken("acc1", "user1")).toBe("token-abc");
  expect(getContextToken("acc1", "user2")).toBeUndefined();
});
```

#### 7.2.4 SendMessage 构造

```typescript
test("build text message request", () => {
  const req = buildTextMessageReq({
    to: "user@im.wechat",
    text: "hello",
    contextToken: "ctx-123",
    clientId: "test-id",
  });
  expect(req.msg.message_type).toBe(2);          // BOT
  expect(req.msg.message_state).toBe(2);          // FINISH
  expect(req.msg.from_user_id).toBe("");          // 始终为空
  expect(req.msg.to_user_id).toBe("user@im.wechat");
  expect(req.msg.context_token).toBe("ctx-123");
  expect(req.msg.item_list).toHaveLength(1);
  expect(req.msg.item_list[0].type).toBe(1);     // TEXT
  expect(req.msg.item_list[0].text_item.text).toBe("hello");
});
```

#### 7.2.5 Account ID Normalize

```typescript
test("normalize account ID", () => {
  expect(normalizeAccountId("abc@im.bot")).toBe("abc-im-bot");
  expect(normalizeAccountId("abc@im.wechat")).toBe("abc-im-wechat");
});

test("derive raw ID from normalized", () => {
  expect(deriveRawAccountId("abc-im-bot")).toBe("abc@im.bot");
  expect(deriveRawAccountId("abc-im-wechat")).toBe("abc@im.wechat");
  expect(deriveRawAccountId("abc")).toBeUndefined();
});
```

#### 7.2.6 Session Guard

```typescript
test("session pause and resume", () => {
  const guard = new SessionGuard();
  expect(guard.isPaused("acc1")).toBe(false);

  guard.pause("acc1");
  expect(guard.isPaused("acc1")).toBe(true);
  expect(guard.getRemainingMs("acc1")).toBeGreaterThan(0);
  expect(guard.getRemainingMs("acc1")).toBeLessThanOrEqual(3600000);

  expect(() => guard.assertActive("acc1")).toThrow();
});

test("sync buf persistence", () => {
  const tmpDir = fs.mkdtempSync("/tmp/openwx-test-");
  const filePath = path.join(tmpDir, "test.sync.json");

  saveSyncBuf(filePath, "buf-data-123");
  expect(loadSyncBuf(filePath)).toBe("buf-data-123");

  fs.rmSync(tmpDir, { recursive: true });
});
```

### 7.3 集成测试（Mock iLink Server）

创建一个本地 mock server 模拟 iLink API:

```typescript
// tests/mock-server.ts
import { createServer } from "node:http";

export function createMockILinkServer(port = 9876) {
  let messages: any[] = [];       // 待返回的消息
  let getUpdatesBuf = "init";
  let sentMessages: any[] = [];   // 记录发出的消息

  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const url = new URL(req.url!, `http://localhost:${port}`);

      // GET /ilink/bot/get_bot_qrcode
      if (url.pathname === "/ilink/bot/get_bot_qrcode") {
        res.end(JSON.stringify({
          qrcode: "mock-qr-code",
          qrcode_img_content: "https://example.com/qr.png",
        }));
        return;
      }

      // GET /ilink/bot/get_qrcode_status
      if (url.pathname === "/ilink/bot/get_qrcode_status") {
        res.end(JSON.stringify({
          status: "confirmed",
          bot_token: "mock-token-123",
          ilink_bot_id: "mock-bot@im.bot",
          baseurl: `http://localhost:${port}`,
          ilink_user_id: "mock-user@im.wechat",
        }));
        return;
      }

      const parsed = JSON.parse(body);

      // POST /ilink/bot/getupdates
      if (url.pathname === "/ilink/bot/getupdates") {
        const msgs = messages.splice(0);  // 取出所有待发消息
        res.end(JSON.stringify({
          ret: 0,
          msgs,
          get_updates_buf: getUpdatesBuf,
        }));
        return;
      }

      // POST /ilink/bot/sendmessage
      if (url.pathname === "/ilink/bot/sendmessage") {
        sentMessages.push(parsed.msg);
        res.end(JSON.stringify({}));
        return;
      }

      // POST /ilink/bot/getconfig
      if (url.pathname === "/ilink/bot/getconfig") {
        res.end(JSON.stringify({
          ret: 0,
          typing_ticket: Buffer.from("mock-ticket").toString("base64"),
        }));
        return;
      }

      // POST /ilink/bot/sendtyping
      if (url.pathname === "/ilink/bot/sendtyping") {
        res.end(JSON.stringify({ ret: 0 }));
        return;
      }

      res.statusCode = 404;
      res.end("Not found");
    });
  });

  return {
    server,
    start: () => new Promise<void>((resolve) => server.listen(port, resolve)),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
    /** 注入一条消息，下次 getupdates 会返回 */
    injectMessage: (msg: any) => messages.push(msg),
    /** 获取 bot 发出的所有消息 */
    getSentMessages: () => sentMessages,
    /** 清空已发消息记录 */
    clearSent: () => { sentMessages = []; },
  };
}
```

#### 7.3.1 集成测试用例

```typescript
// tests/integration/full-flow.test.ts

let mock: ReturnType<typeof createMockILinkServer>;
let client: ILinkClient;

beforeAll(async () => {
  mock = createMockILinkServer(9876);
  await mock.start();
});

afterAll(async () => {
  client?.dispose();
  await mock.stop();
});

test("login flow", async () => {
  client = new ILinkClient({ baseUrl: "http://localhost:9876" });
  const result = await client.login();
  expect(result.token).toBe("mock-token-123");
  expect(result.accountId).toContain("mock-bot");
});

test("receive and reply to message", async () => {
  // 注入一条用户消息
  mock.injectMessage({
    from_user_id: "user1@im.wechat",
    message_type: 1,
    context_token: "ctx-abc",
    item_list: [{ type: 1, text_item: { text: "hello" } }],
  });

  // 轮询获取
  const result = await client.poll();
  expect(result.messages).toHaveLength(1);
  expect(result.messages[0].text).toBe("hello");
  expect(result.messages[0].from).toBe("user1@im.wechat");

  // 回复
  await client.sendText("user1@im.wechat", "hi back!");

  // 验证发出的消息
  const sent = mock.getSentMessages();
  expect(sent).toHaveLength(1);
  expect(sent[0].msg.to_user_id).toBe("user1@im.wechat");
  expect(sent[0].msg.context_token).toBe("ctx-abc");
  expect(sent[0].msg.message_type).toBe(2);  // BOT
  expect(sent[0].msg.message_state).toBe(2);  // FINISH
});

test("session expired handling", async () => {
  // Mock 返回 -14
  // 修改 mock server 在 getupdates 返回 errcode: -14
  // 验证 client 进入暂停状态
});

test("get_updates_buf persistence", async () => {
  // 验证轮询后 buf 被保存
  // 创建新 client 实例，验证从文件恢复 buf
});
```

### 7.4 端到端测试（需要真实微信）

#### 7.4.1 手动验证清单

在真实微信账号上逐一验证:

| # | 测试项 | 验证方法 | 预期结果 |
|---|--------|---------|---------|
| 1 | QR 登录 | 运行 login，扫码 | 终端显示"连接成功"，token 文件生成 |
| 2 | 文本收发 | 微信发 "ping" | 收到 "pong" 或 echo 回复 |
| 3 | 中文消息 | 微信发中文长文本 | 完整收到并正确回复 |
| 4 | 图片接收 | 微信发图片 | Bot 收到图片（下载解密成功） |
| 5 | 图片发送 | 触发图片回复 | 微信收到图片（显示正常） |
| 6 | 文件收发 | 微信发 PDF | Bot 收到并能回复文件 |
| 7 | 语音转文字 | 微信发语音 | Bot 收到转写文字 |
| 8 | 引用消息 | 引用某条消息回复 | Bot 收到引用内容 |
| 9 | 长时间运行 | 运行 1 小时 | 持续正常收发，无内存泄漏 |
| 10 | 重启恢复 | Kill 进程再启动 | 不重复处理历史消息 |
| 11 | Session 过期 | 在另一设备扫码 | 收到 -14，暂停 1 小时 |
| 12 | 并发消息 | 快速连发 10 条 | 全部正确处理和回复 |
| 13 | Typing 指示 | AI 处理时 | 微信显示"对方正在输入..." |

#### 7.4.2 自动 E2E 测试脚本

```typescript
// tests/e2e/smoke.test.ts
// 需要环境变量: OPENWX_TOKEN, OPENWX_ACCOUNT_ID, OPENWX_TEST_USER

test("e2e: text roundtrip", async () => {
  const client = new ILinkClient({
    token: process.env.OPENWX_TOKEN,
  });

  // 等待测试用户发消息（或使用另一个 bot 模拟）
  // ...

  // 验证发送
  await client.sendText(process.env.OPENWX_TEST_USER!, "e2e test reply");
  // 人工在微信验证收到消息
});
```

### 7.5 CI/CD 测试配置

```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install
      - run: npm test -- --filter=unit

  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npm install
      - run: npm test -- --filter=integration
```

### 7.6 开发阶段验证节点

| 阶段 | 完成标准 | 验证方式 |
|------|---------|---------|
| core 完成 | 登录 + 收发文本 | E2E 手动测试 #1-3 |
| 媒体完成 | 图片/文件收发 | E2E 手动测试 #4-7 |
| bot 完成 | createBot 3 行代码可用 | 跑 echo bot |
| hub 完成 | 多路由转发 | 前缀路由测试 |
| connectors 完成 | Claude Code 可用 | 微信发问题，收到 AI 回复 |

---

## 8. 开发环境搭建

### 8.1 前置要求

- Node.js >= 22 (LTS)
- pnpm >= 9（monorepo 管理）
- 一个微信账号（用于测试）
- Git

### 8.2 初始化

```bash
git clone https://github.com/B4yesC4t/openWX.git
cd openWX
pnpm install
```

### 8.3 Monorepo 配置

```json
// package.json (root)
{
  "name": "openwx",
  "private": true,
  "workspaces": ["packages/*", "packages/connectors/*", "examples/*"],
  "scripts": {
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "test:unit": "pnpm -r test -- --filter=unit",
    "test:integration": "pnpm -r test -- --filter=integration",
    "lint": "pnpm -r lint"
  },
  "devDependencies": {
    "typescript": "^5.7",
    "vitest": "^3.0",
    "tsdown": "^0.10"
  }
}
```

### 8.4 TypeScript 配置

```json
// tsconfig.json (root)
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

### 8.5 快速验证

```bash
# 1. 构建
pnpm build

# 2. 跑单元测试
pnpm test:unit

# 3. 跑 echo bot 验证（需要微信扫码）
cd examples/minimal
node index.mjs
# 扫码后，微信发消息，应收到 echo 回复
```

---

## 9. 附录：完整类型定义

以下是从参考实现中提取的完整 TypeScript 类型定义，直接用于 `packages/core/src/types.ts`:

```typescript
// ============================================================================
// 基础类型
// ============================================================================

/** 每个 API 请求都带的元信息 */
export interface BaseInfo {
  channel_version?: string;
}

// ============================================================================
// 媒体类型枚举
// ============================================================================

export const UploadMediaType = {
  IMAGE: 1,
  VIDEO: 2,
  FILE: 3,
  VOICE: 4,
} as const;

export const MessageType = {
  NONE: 0,
  USER: 1,
  BOT: 2,
} as const;

export const MessageItemType = {
  NONE: 0,
  TEXT: 1,
  IMAGE: 2,
  VOICE: 3,
  FILE: 4,
  VIDEO: 5,
} as const;

export const MessageState = {
  NEW: 0,
  GENERATING: 1,
  FINISH: 2,
} as const;

export const TypingStatus = {
  TYPING: 1,
  CANCEL: 2,
} as const;

// ============================================================================
// CDN 媒体引用
// ============================================================================

/** CDN 媒体引用，aes_key 在 JSON 中是 base64 编码的字节 */
export interface CDNMedia {
  /** CDN 下载加密参数 */
  encrypt_query_param?: string;
  /** AES-128 密钥，base64 编码 */
  aes_key?: string;
  /** 加密类型: 0=只加密 fileid, 1=打包缩略图/中图等信息 */
  encrypt_type?: number;
}

// ============================================================================
// 消息 Item 类型
// ============================================================================

export interface TextItem {
  text?: string;
}

export interface ImageItem {
  media?: CDNMedia;
  thumb_media?: CDNMedia;
  /** Raw AES-128 key (hex, 16 bytes) */
  aeskey?: string;
  url?: string;
  mid_size?: number;
  thumb_size?: number;
  thumb_height?: number;
  thumb_width?: number;
  hd_size?: number;
}

export interface VoiceItem {
  media?: CDNMedia;
  /** 编码类型: 1=pcm 2=adpcm 3=feature 4=speex 5=amr 6=silk 7=mp3 8=ogg-speex */
  encode_type?: number;
  bits_per_sample?: number;
  sample_rate?: number;
  /** 语音长度(毫秒) */
  playtime?: number;
  /** 语音转文字内容 */
  text?: string;
}

export interface FileItem {
  media?: CDNMedia;
  file_name?: string;
  md5?: string;
  /** 文件大小(字节)，字符串格式 */
  len?: string;
}

export interface VideoItem {
  media?: CDNMedia;
  video_size?: number;
  play_length?: number;
  video_md5?: string;
  thumb_media?: CDNMedia;
  thumb_size?: number;
  thumb_height?: number;
  thumb_width?: number;
}

export interface RefMessage {
  message_item?: MessageItem;
  /** 摘要 */
  title?: string;
}

export interface MessageItem {
  type?: number;
  create_time_ms?: number;
  update_time_ms?: number;
  is_completed?: boolean;
  msg_id?: string;
  ref_msg?: RefMessage;
  text_item?: TextItem;
  image_item?: ImageItem;
  voice_item?: VoiceItem;
  file_item?: FileItem;
  video_item?: VideoItem;
}

// ============================================================================
// 消息结构
// ============================================================================

export interface WeixinMessage {
  seq?: number;
  message_id?: number;
  from_user_id?: string;
  to_user_id?: string;
  client_id?: string;
  create_time_ms?: number;
  update_time_ms?: number;
  delete_time_ms?: number;
  session_id?: string;
  group_id?: string;
  message_type?: number;
  message_state?: number;
  item_list?: MessageItem[];
  /** 必须在回复时原样传回! */
  context_token?: string;
}

// ============================================================================
// API 请求/响应
// ============================================================================

export interface GetUpdatesReq {
  get_updates_buf?: string;
}

export interface GetUpdatesResp {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  msgs?: WeixinMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
}

export interface SendMessageReq {
  msg?: WeixinMessage;
}

export interface GetUploadUrlReq {
  filekey?: string;
  media_type?: number;
  to_user_id?: string;
  rawsize?: number;
  rawfilemd5?: string;
  filesize?: number;
  thumb_rawsize?: number;
  thumb_rawfilemd5?: string;
  thumb_filesize?: number;
  no_need_thumb?: boolean;
  aeskey?: string;
}

export interface GetUploadUrlResp {
  upload_param?: string;
  thumb_upload_param?: string;
}

export interface SendTypingReq {
  ilink_user_id?: string;
  typing_ticket?: string;
  status?: number;
}

export interface GetConfigResp {
  ret?: number;
  errmsg?: string;
  typing_ticket?: string;
}
```

---

## 附录: 术语表

| 术语 | 说明 |
|------|------|
| iLink | 腾讯微信 Bot API 协议名称 |
| bot_token | 扫码登录后获得的认证凭证 |
| context_token | 每条消息携带的对话关联标识，回复时必须原样传回 |
| get_updates_buf | 长轮询游标，标记已读位置，必须持久化 |
| CDN | 微信媒体文件存储服务 |
| encrypt_query_param | CDN 媒体的加密访问参数 |
| AES-128-ECB | 媒体文件加密算法（16字节密钥，PKCS7填充） |
| Normalized ID | 将 `@im.bot` 格式转为 `-im-bot` 格式，用于文件名 |
| Session Expired (-14) | Bot token 失效（通常因为同一微信在别处绑定了新 bot） |
| Long Polling | 服务端 hold 请求直到有数据或超时的通信模式 |
