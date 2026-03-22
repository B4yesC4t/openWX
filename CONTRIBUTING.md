# Contributing to openWX

Thanks for improving openWX. This repository is a pnpm workspace for the official iLink Bot API SDK layers and connectors.

## Development Environment

- Node.js: `>=20`
- Package manager: `pnpm@10`
- Install dependencies:

```bash
pnpm install
```

- Build all packages:

```bash
pnpm build
```

- Validate before every push:

```bash
pnpm test
pnpm lint
```

## Repository Structure

- `packages/core`: protocol client, auth, polling, media, crypto, store
- `packages/bot`: `createBot()` wrapper, handlers, lifecycle
- `packages/hub`: routing config and router scaffold
- `packages/connectors/*`: prebuilt connector entry points
- `examples/*`: example placeholders and future runnable recipes
- `DEVELOPMENT.md`: protocol specification and implementation reference

Read [`DEVELOPMENT.md`](./DEVELOPMENT.md) before making behavior changes. It is the canonical source for protocol requirements and edge cases.

## Branch Strategy

- Branch from `main`
- Use a focused branch name such as `feature/<topic>`, `fix/<topic>`, or `docs/<topic>`
- Keep one logical change per branch
- Rebase or merge the latest `main` before opening or updating a PR

## Pull Request Process

### PR title format

Use a Conventional Commits style title:

```text
type(scope): 简短中文描述
```

Examples:

```text
docs(readme): 完善根目录文档与开源标准文件
fix(core): 修正长轮询超时处理
```

### PR description checklist

Include:

- What changed
- Why it changed
- Validation performed
- Linked Linear issue, for example `AS-187`
- Screenshots or rendered previews when the change affects docs/UI

### Review flow

1. Open the PR against `main`
2. Ensure CI is green
3. Address review feedback with incremental commits
4. Re-run `pnpm build`, `pnpm test`, and `pnpm lint` after significant updates

## Code Style

- Language: TypeScript ESM
- Lint: `eslint`
- Format: `prettier`
- Prefer clear public APIs over clever abstractions
- Keep comments brief and only where they materially clarify behavior

Useful commands:

```bash
pnpm lint
pnpm prettier . --write
```

## Testing Requirements

- Every feature must include automated tests
- Keep tests near the owning package under `tests/`
- Use `vitest` for unit coverage
- Mock network calls with `nock` or similar test doubles when protocol flows are involved
- CI runs build, typecheck, lint, and test on every PR

## Commit Message Format

This repository uses Conventional Commits with a stricter body/footer format for tracked work:

```text
<type>(<scope>): 一到两句简短中文描述

1. 主要改动一
2. 主要改动二

AS-000: issue 标题
```

Allowed `type` values:

- `feat`
- `fix`
- `refactor`
- `test`
- `docs`
- `chore`
- `ci`

## Reporting Issues

Use the GitHub issue forms in [`.github/ISSUE_TEMPLATE/`](./.github/ISSUE_TEMPLATE/):

- `Bug Report`: reproducible defects, regressions, protocol mismatches
- `Feature Request`: API additions, package improvements, documentation proposals

Security issues must not be filed publicly. Follow [`SECURITY.md`](./SECURITY.md).
