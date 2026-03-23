import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { resolveAssistantProfile, saveAssistantProfile } from "../src/setup.js";

describe("resolveAssistantProfile", () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(
      tempDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
    );
  });

  it("builds an OpenRouter profile from environment variables", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openwx-assistant-"));
    tempDirectories.push(tempDir);
    const configPath = path.join(tempDir, "assistant.runtime.json");

    const profile = await resolveAssistantProfile({
      env: {
        OPENWX_PROVIDER: "openrouter",
        OPENROUTER_API_KEY: "sk-or-demo",
        OPENROUTER_MODEL: "openai/gpt-4.1-mini"
      },
      configPath,
      isInteractive: false
    });

    expect(profile).toEqual({
      provider: "openrouter",
      openRouterApiKey: "sk-or-demo",
      openRouterModel: "openai/gpt-4.1-mini",
      configPath
    });
  });

  it("loads a previously saved custom chatbot profile without prompting", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openwx-assistant-"));
    tempDirectories.push(tempDir);
    const configPath = path.join(tempDir, "assistant.runtime.json");

    await saveAssistantProfile(
      {
        provider: "custom-chatbot",
        customEndpoint: "https://example.com/agent"
      },
      configPath
    );

    const profile = await resolveAssistantProfile({
      env: {},
      configPath,
      isInteractive: false
    });

    expect(profile).toEqual({
      provider: "custom-chatbot",
      customEndpoint: "https://example.com/agent",
      openRouterModel: "openai/gpt-4.1-mini",
      configPath
    });
  });
});
