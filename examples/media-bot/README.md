# Media Bot Example

这个示例展示 openWX 的媒体能力：下载图片、读取尺寸、回传图片和发送文件。

This example demonstrates openWX media features: download images, inspect them, send images back, and send files.

## 运行 / Run

```bash
pnpm install
pnpm --filter @openwx/example-media-bot start
```

## 在微信里怎么试 / What to Send in WeChat

- 发一张图片
- 发 `/cat`
- 发 `/readme`

- send an image
- send `/cat`
- send `/readme`

## 你可以验证什么 / What You Can Validate

- 用户发送图片后，Bot 下载并解析图片
- `/cat` 回传本地图片
- `/readme` 回传文件

- image download and parsing
- `/cat` sends a local image back
- `/readme` sends a file back
