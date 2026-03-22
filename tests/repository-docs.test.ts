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
