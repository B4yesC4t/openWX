# Troubleshooting

## 先查什么

1. openWX 源码是否已重新读取，而不是沿用旧片段。
2. 当前项目的 Node 版本、包管理器、脚本是否匹配。
3. 入口文件、环境变量、Hub 配置、HTTP Proxy endpoint 是否都落到了实际运行目录。

## 常见故障

### 扫码后没有正常收发消息

- 先检查是否真的完成了登录确认，而不是停在 `scaned`。
- 如果能收到消息但回复不显示，优先检查 `context_token` 是否按收到的最新值回传。
- 如果刚换了新的 Bot 扫码，旧实例可能已经因为 `errcode = -14` 失效，需要进入一小时冷却。

### 重启后 Bot 疯狂回复历史消息

- 检查 `get_updates_buf` 是否被持久化到磁盘。
- 检查重启时是否从同一个存储目录恢复了游标。
- 不要在每次启动时都把游标重置为空字符串。

### HTTP 请求一直失败

- 检查 `X-WECHAT-UIN` 是否按 `base64(String(randomUint32()))` 生成。
- 检查所有请求是否都使用 `bot_type = "3"`。
- 对轮询接口，确认超时设置匹配长轮询，不要把客户端超时误判成致命错误。

### 图片、视频、文件下载或解密失败

- 检查 `aes_key` 是否按两种编码格式兼容处理。
- 图片可能是 `base64(raw 16 bytes)`。
- 文件、语音、视频可能是 `base64(hex string)`，需要二次 hex 解码。

### HTTP Proxy 场景上游服务没有收到请求

- 确认 sidecar 发往的是 `${endpoint}/chat`，不是裸根路径。
- 确认请求 JSON 至少包含 `conversationId`、`text`，有媒体时还要附带 `media`。
- 如果开启 webhook 模式，预期是微信先收到“已收到”，上游异步处理，不要误判为丢消息。

### Claude Code connector 没有返回内容

- 先检查本机是否存在可执行的 `claude` CLI。
- 再检查 model、timeout、system prompt 是否落到实际 handler 配置里。
- 如果 CLI 不可用，按当前连接器实现应给出降级提示，而不是卡死。

## 协议坑点速查

- `context_token` 不回传：用户看不到回复。
- `get_updates_buf` 不持久化：重启后扫历史消息。
- `X-WECHAT-UIN` 格式错误：请求被拒。
- `aes_key` 双编码没处理：媒体解密失败。
- `errcode = -14`：一小时冷却，不要死循环重试。
- `bot_type` 不是 `"3"`：接口行为异常。
