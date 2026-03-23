import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

const markdownFiles = [
  "README.md",
  "CONTRIBUTING.md",
  "CODE_OF_CONDUCT.md",
  "SECURITY.md",
  "CHANGELOG.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".claude/skills/wechat-integration/SKILL.md",
  ".claude/skills/wechat-integration/examples.md",
  ".claude/skills/wechat-integration/troubleshooting.md",
  "packages/core/README.md",
  "packages/bot/README.md",
  "packages/hub/README.md",
  "packages/connectors/README.md",
  "packages/connectors/echo/README.md",
  "packages/connectors/http-proxy/README.md",
  "packages/connectors/claude-code/README.md"
] as const;

const templateFiles = [
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml"
] as const;

const publicPackages = [
  "packages/core/package.json",
  "packages/bot/package.json",
  "packages/hub/package.json",
  "packages/connectors/echo/package.json",
  "packages/connectors/http-proxy/package.json",
  "packages/connectors/claude-code/package.json"
] as const;

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

describe("repository documentation", () => {
  it("includes the required top-level and package README files", async () => {
    await Promise.all(
      markdownFiles.map(async (relativePath) => {
        await expect(readRepoFile(relativePath)).resolves.toContain("#");
      })
    );
  });

  it("includes the required GitHub issue templates", async () => {
    await Promise.all(
      templateFiles.map(async (relativePath) => {
        await expect(readRepoFile(relativePath)).resolves.toContain("name:");
      })
    );
  });

  it("covers the expected README sections", async () => {
    const readme = await readRepoFile("README.md");

    expect(readme).toContain("## Quick Start | 快速开始");
    expect(readme).toContain("## Installation Matrix | 安装指南");
    expect(readme).toContain("### `ILinkClient` (`@openwx/core`)");
    expect(readme).toContain("### `createBot` (`@openwx/bot`)");
    expect(readme).toContain("### Hub Configuration (`@openwx/hub`)");
    expect(readme).toContain("## Architecture | 架构图");
    expect(readme).toContain("## FAQ | 常见问题");
    expect(readme).toContain("## Contributing | 参与贡献");
    expect(readme).toContain("## License");
    expect(readme).toContain("./packages/connectors/README.md");
  });

  it("covers the contributing workflow and review requirements", async () => {
    const contributing = await readRepoFile("CONTRIBUTING.md");

    expect(contributing).toContain("## Development Environment");
    expect(contributing).toContain("## Branch Strategy");
    expect(contributing).toContain("## Pull Request Process");
    expect(contributing).toContain("## Code Style");
    expect(contributing).toContain("## Testing Requirements");
    expect(contributing).toContain("## Commit Message Format");
  });

  it("documents the Claude Code wechat integration skill and its support files", async () => {
    const skill = await readRepoFile(".claude/skills/wechat-integration/SKILL.md");
    const examples = await readRepoFile(".claude/skills/wechat-integration/examples.md");
    const troubleshooting = await readRepoFile(
      ".claude/skills/wechat-integration/troubleshooting.md"
    );

    expect(skill.startsWith("---\nname: wechat-integration\n")).toBe(true);
    expect(skill).toContain("description:");
    expect(skill).toContain("微信");
    expect(skill).toContain("WeChat");
    expect(skill).toContain("DEVELOPMENT.md");
    expect(skill).toContain("packages/bot/src/create-bot.ts");
    expect(skill).toContain("packages/hub/src/config.ts");
    expect(skill).toContain("packages/connectors/http-proxy/src/index.ts");
    expect(skill).toContain("接入模式");
    expect(skill).toContain("后端选择");
    expect(skill).toContain("多用户");
    expect(skill).toContain("媒体");
    expect(skill).toContain("询问 -> 执行 -> 验证");
    expect(skill).toContain("[examples.md](examples.md)");
    expect(skill).toContain("[troubleshooting.md](troubleshooting.md)");

    expect(examples).toContain("## 场景一：纯聊天 Bot");
    expect(examples).toContain("## 场景二：AI 助手 Bot");
    expect(examples).toContain("## 场景三：现有 HTTP 服务接入");

    expect(troubleshooting).toContain("context_token");
    expect(troubleshooting).toContain("get_updates_buf");
    expect(troubleshooting).toContain("X-WECHAT-UIN");
    expect(troubleshooting).toContain("aes_key");
    expect(troubleshooting).toContain("errcode = -14");
  });
});

describe("package metadata", () => {
  it("marks all publishable packages as 0.1.0 public packages with repository links", async () => {
    const manifests = await Promise.all(
      publicPackages.map(async (relativePath) => {
        const content = await readRepoFile(relativePath);
        return JSON.parse(content) as Record<string, unknown>;
      })
    );

    for (const manifest of manifests) {
      expect(manifest.version).toBe("0.1.0");
      expect(manifest.description).toEqual(expect.any(String));
      expect(manifest.keywords).toEqual(
        expect.arrayContaining([expect.any(String)])
      );
      expect(manifest.types).toEqual(expect.any(String));
      expect(manifest.exports).toBeTypeOf("object");
      expect(manifest.files).toEqual(expect.arrayContaining(["dist"]));
      expect(manifest.engines).toEqual(
        expect.objectContaining({
          node: ">=20"
        })
      );
      expect(manifest.publishConfig).toEqual(
        expect.objectContaining({
          access: "public"
        })
      );
      expect(manifest.repository).toEqual(
        expect.objectContaining({
          type: "git",
          url: "git+https://github.com/B4yesC4t/openWX.git"
        })
      );
      expect(manifest.bugs).toEqual(
        expect.objectContaining({
          url: "https://github.com/B4yesC4t/openWX/issues"
        })
      );
      expect(manifest.homepage).toBe(
        "https://github.com/B4yesC4t/openWX#readme"
      );
    }
  });
});
