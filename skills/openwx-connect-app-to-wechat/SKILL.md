---
name: openwx-connect-app-to-wechat
description: Use when a user wants to connect their own app, agent, chatbot, Claude Code, Codex, OpenRouter workflow, or other AI/normal application to WeChat through openWX. Handles repo discovery or cloning, app-type classification, choosing single-agent vs multi-app routing, picking the right built-in connector or custom integration path, QR-first login, and end-to-end verification.
---

# openWX Connect App To WeChat

Use this skill when the goal is to connect an existing application to WeChat through openWX.

This skill must work even if the user only has this `SKILL.md` file. Do not assume the `openWX` repository is already present.

## Outcome

Drive the user to one of these working outcomes:

- `Claude` connected to WeChat
- `Codex` connected to WeChat
- `OpenRouter` connected to WeChat
- `自定义 chatbot` connected through an HTTP endpoint
- `多应用接入` with prefix routing
- a new custom connector plan when the app does not fit the built-in paths

For end users, prefer QR-first login and never require them to know a WeChat token on first setup.

## First Questions

If the app type is not obvious, ask only the minimum needed:

1. What is the app type?
   Options to clarify in plain language:
   - Claude Code
   - Codex
   - OpenRouter-based app
   - self-built agent
   - chatbot
   - other AI app
   - normal app
2. Is the user connecting one app or multiple apps?
3. How is the app exposed?
   - local CLI on this machine
   - HTTP API / webhook
   - SDK / library only
   - desktop app only
4. If OpenRouter is involved, does the user already have an API key?

Do not ask about WeChat token first. openWX supports QR login.

## Repo Discovery

Before changing code, determine whether the `openWX` repository is available in the current workspace.

Look for these markers:

- `package.json` with `"name": "openwx"`
- `packages/core/src/client.ts`
- `examples/assistant/index.ts`

If the repo is missing:

1. Choose a sensible clone location such as `./openWX` or `~/openWX`.
2. Clone:

```bash
git clone https://github.com/B4yesC4t/openWX.git
cd openWX
pnpm install
```

3. Continue inside that repo.

If the repo is present, reuse it and avoid recloning.

## Default Product Choice

There are two user-facing entry modes:

- `examples/assistant`: default for end users
- `examples/multi-app`: advanced prefix-routing mode

Use `examples/assistant` unless the user explicitly needs multiple apps at once.

When using `examples/assistant`, the first-run choices are:

- `Claude`
- `Codex`
- `OpenRouter`
- `自定义 chatbot`
- `多应用接入`

Only `多应用接入` should use prefixes like `/claude` or `/codex`.
All single-app modes should support direct chat with no prefix.

## App Type Decision

Map the user app to one of these paths.

### 1. Claude Code

Use when the app is the local `claude` CLI.

Path:

- Single app: `examples/assistant` -> choose `Claude`
- Multiple apps: `examples/assistant` -> choose `多应用接入`, or use `examples/multi-app`

Relevant repo files when present:

- `examples/assistant/index.ts`
- `examples/assistant/src/runtime.ts`
- `packages/connectors/claude-code/src/index.ts`

### 2. Codex

Use when the app is the local `codex` CLI.

Path:

- Single app: `examples/assistant` -> choose `Codex`
- Multiple apps: `examples/assistant` -> choose `多应用接入`, or use `examples/multi-app`

Relevant repo files:

- `examples/assistant/src/runtime.ts`
- `packages/connectors/codex/src/index.ts`

### 3. OpenRouter App

Use when the user wants a direct OpenRouter-backed assistant.

Path:

- Single app: `examples/assistant` -> choose `OpenRouter`
- Multiple apps: `examples/assistant` -> choose `多应用接入`

Rules:

- Ask for the OpenRouter API key only if it is actually needed
- Never write the key into tracked repository files
- Prefer runtime input, environment variables, or local runtime config outside git

Relevant repo files:

- `examples/assistant/src/setup.ts`
- `packages/connectors/openrouter/src/index.ts`

### 4. 自建 Agent / Chatbot / Other App With HTTP API

If the user already has an HTTP service, this is the lowest-friction path.

Use:

- `examples/assistant` -> choose `自定义 chatbot`
- configure the user endpoint
- route through the built-in HTTP proxy connector

Expected endpoint shape:

- openWX sends `POST {endpoint}/chat`
- request body includes `conversationId`, `text`, and optional `media`
- response returns `text` and optional `media`

Relevant repo files:

- `packages/connectors/http-proxy/src/index.ts`
- `examples/assistant/src/runtime.ts`

### 5. Normal App Without HTTP API

If the app has no HTTP interface:

- If it is a local CLI or local process, consider wrapping it in a small local HTTP service first
- If it is library-only or has unusual IPC, create a custom connector package

Prefer wrapping with HTTP first because it is faster and less invasive.

Only create a new connector when:

- the app cannot reasonably expose HTTP
- or the integration needs tighter local control than HTTP provides

## When To Build A Custom Connector

Create a custom connector when the app is:

- a local CLI other than Claude/Codex
- a desktop app with local automation hooks
- a private SDK/library with no HTTP surface
- a special local AI tool that must run in-process

Implementation pattern:

1. Add a package under `packages/connectors/<name>`
2. Export:
   - `create<Name>Connector()`
   - `create<Name>Handler()`
3. Re-export from `packages/connectors/src/index.ts`
4. If needed in hub routing, add the handler name in `packages/hub/src/config.ts`
5. Add tests matching the style of existing connector packages

Use these as reference implementations:

- `packages/connectors/claude-code/src/index.ts`
- `packages/connectors/codex/src/index.ts`
- `packages/connectors/http-proxy/src/index.ts`
- `packages/connectors/openrouter/src/index.ts`

## QR-First Login Rules

For end-user setup:

- prefer QR login over asking for `OPENWX_TOKEN`
- use the QR image auto-open flow
- let openWX persist the login state locally

Relevant repo files:

- `packages/core/src/auth.ts`
- `packages/core/src/qr-display.ts`
- `examples/multi-app/src/qr-login.ts`
- `packages/bot/src/lifecycle.ts`

Expected behavior:

1. start the selected example
2. if no saved login state exists, open a QR code PNG in the default image viewer
3. user scans
4. login state is saved locally
5. later runs restore automatically

## Recommended Execution Paths

### Single App

Default command:

```bash
pnpm --filter @openwx/example-assistant start
```

Expected behavior:

- first run asks the user to choose one provider
- then asks for OpenRouter key or custom endpoint only when needed
- then opens the QR login image if login is not yet stored

### Multiple Apps

Use when the user explicitly wants several apps on one WeChat account.

Preferred path:

```bash
pnpm --filter @openwx/example-assistant start
```

Then choose `多应用接入`.

Advanced path:

```bash
pnpm --filter @openwx/example-multi-app start
```

Use prefixes only in this mode.

## Verification Checklist

After setup, verify the end-to-end path instead of stopping at configuration.

### Single App Verification

- send a plain message with no prefix
- confirm typing appears
- confirm the selected app responds

Examples:

- Claude mode: send `用一句话介绍 openWX`
- Codex mode: send `帮我解释这个项目`
- OpenRouter mode: send `你好`
- 自定义 chatbot mode: send a basic echo/test message

### Multi-App Verification

- `/claude 用一句话介绍 openWX`
- `/codex 用一句话介绍 openWX`
- `/router 用一句话介绍 openWX`
- `/echo hello`

## Failure Handling

If the setup does not work, classify the failure:

- repo missing: clone it
- dependencies missing: run `pnpm install`
- CLI missing: install or authenticate `claude` / `codex`
- OpenRouter key missing: prompt for it only in OpenRouter-related modes
- no HTTP endpoint: switch to wrapper service or custom connector plan
- no QR shown: inspect QR display path and local file opening
- no replies: verify polling, typing, and message send path

## Deliverable Standard

Do not stop with abstract advice.

For each user request, produce one of these concrete outcomes:

- the app is actually connected and verified
- a custom connector was implemented and verified
- a wrapper-service plan was chosen, with the exact next coding step started
- or a precise blocker is identified with the missing prerequisite

If the user only has this skill file, this skill should still be enough to:

- get or clone the repository
- choose the right integration path
- run the correct example or implementation route
- and verify WeChat messaging end to end
