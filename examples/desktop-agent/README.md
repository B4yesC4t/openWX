# Desktop Agent Example

这个示例把微信消息映射到本地桌面操作，适合做受控的桌面 agent 或内部自动化入口。

This example maps WeChat messages to local desktop actions and is useful for controlled desktop agents or internal automation.

## 能做什么 / What It Does

- `/ls [path]`
- `/screenshot`
- `/exec <command>`
- 危险命令需要先 `/confirm`
- 只对白名单用户生效

- `/ls [path]`
- `/screenshot`
- `/exec <command>`
- dangerous commands require `/confirm`
- only whitelisted users are allowed

## 运行 / Run

```bash
pnpm install
pnpm --filter @openwx/example-desktop-agent start
```

## 在微信里怎么试 / What to Send in WeChat

- `/ls`
- `/screenshot`
- `/exec pwd`

- `/ls`
- `/screenshot`
- `/exec pwd`

## 注意 / Notes

这是高权限示例，不适合作为普通终端用户的默认入口。
更通用的用户入口请先看 [`assistant`](../assistant)。

This is a high-privilege example and should not be the default entry for general end users.
Use [`assistant`](../assistant) for the standard user-facing flow.
