import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  defineHubConfig,
  loadHubConfig,
  parseHubConfig,
  substituteEnvironmentVariables
} from "../src/config.js";

describe("hub config", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it("parses YAML config files and substitutes environment variables", async () => {
    const configPath = await writeTempConfig(
      "hub.yaml",
      [
        "auth:",
        "  token: ${OPENWX_TOKEN}",
        "routes:",
        "  - prefix: /ai",
        "    handler: claude-code",
        "    config:",
        "      model: claude-sonnet-4-20250514",
        "  - default: true",
        "    handler: http-proxy",
        "    config:",
        "      endpoint: https://example.com/chat"
      ].join("\n")
    );

    const config = await loadHubConfig(configPath, {
      env: {
        OPENWX_TOKEN: "token-123"
      }
    });

    expect(config.auth?.token).toBe("token-123");
    expect(config.routes[0]?.prefix).toBe("/ai");
    expect(config.routes[0]?.config).toEqual({
      model: "claude-sonnet-4-20250514"
    });
    expect(config.routes[1]?.default).toBe(true);
  });

  it("parses JSON config files", async () => {
    const configPath = await writeTempConfig(
      "hub.json",
      JSON.stringify({
        routes: [
          {
            keywords: ["echo"],
            handler: "echo"
          },
          {
            default: true,
            handler: "http-proxy"
          }
        ]
      })
    );

    const config = await loadHubConfig(configPath);
    expect(config.routes[0]?.keywords).toEqual(["echo"]);
    expect(config.routes[1]?.handler).toBe("http-proxy");
  });

  it("validates supported handlers and required fields", () => {
    expect(() =>
      defineHubConfig({
        routes: [
          {
            prefix: "/ai",
            handler: "unknown"
          }
        ]
      })
    ).toThrow(/unsupported handler "unknown"/i);

    expect(() =>
      parseHubConfig(
        JSON.stringify({
          routes: [
            {
              handler: "echo"
            }
          ]
        }),
        { format: "json" }
      )
    ).toThrow(/must define one matcher or set default: true/i);
  });

  it("rejects missing environment variables and invalid matcher combinations", () => {
    expect(() =>
      substituteEnvironmentVariables("token: ${MISSING_TOKEN}", {})
    ).toThrow(/Missing environment variable "MISSING_TOKEN"/);

    expect(() =>
      parseHubConfig(
        JSON.stringify({
          routes: [
            {
              prefix: "/ai",
              default: true,
              handler: "claude-code"
            }
          ]
        }),
        { format: "json" }
      )
    ).toThrow(/must define exactly one matcher type/i);
  });

  async function writeTempConfig(fileName: string, content: string): Promise<string> {
    const directory = await mkdtemp(path.join(os.tmpdir(), "openwx-hub-config-"));
    tempDirectories.push(directory);
    const filePath = path.join(directory, fileName);
    await writeFile(filePath, content, "utf8");
    return filePath;
  }
});
