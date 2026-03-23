import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it } from "vitest";

import { resolveOpenRouterSettings } from "../src/runtime-config.js";

describe("resolveOpenRouterSettings", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it("prefers environment variables without prompting", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openwx-multi-app-config-"));
    tempDirectories.push(tempDir);

    const settings = await resolveOpenRouterSettings({
      env: {
        OPENROUTER_API_KEY: "env-key",
        OPENROUTER_MODEL: "openai/gpt-4.1-mini"
      },
      configPath: path.join(tempDir, "runtime.json"),
      isInteractive: false
    });

    expect(settings).toEqual({
      apiKey: "env-key",
      model: "openai/gpt-4.1-mini",
      configPath: path.join(tempDir, "runtime.json")
    });
  });

  it("prompts once and persists the API key for later runs", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openwx-multi-app-config-"));
    tempDirectories.push(tempDir);
    const configPath = path.join(tempDir, "runtime.json");
    const input = new PassThrough();
    const output = new PassThrough();

    input.end("sk-or-test\n");

    const settings = await resolveOpenRouterSettings({
      env: {},
      configPath,
      input,
      output,
      isInteractive: true
    });

    expect(settings).toEqual({
      apiKey: "sk-or-test",
      model: "openai/gpt-4.1-mini",
      configPath
    });

    await expect(readFile(configPath, "utf8")).resolves.toContain("sk-or-test");
  });
});
