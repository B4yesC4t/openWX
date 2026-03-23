import { describe, expect, it } from "vitest";

import { createBot } from "../src/create-bot.js";
import { FakeClient } from "./test-helpers.js";

describe("createBot", () => {
  it("requires onMessage or at least one command handler", () => {
    expect(() => createBot({})).toThrow(
      "createBot requires onMessage or at least one command handler."
    );
  });

  it("rejects commands without a leading slash", () => {
    expect(() =>
      createBot({
        commands: {
          help: async () => undefined
        }
      })
    ).toThrow('Command "help" must start with "/".');
  });

  it("creates a managed bot around the provided client factory", () => {
    const client = new FakeClient("bot-token");
    const bot = createBot(
      {
        onMessage: async () => "pong"
      },
      {
        clientFactory: () => client
      }
    );

    expect(bot.client).toBe(client);
    expect(bot.state).toBe("idle");
  });

  it("rejects invalid autoTyping intervals", () => {
    expect(() =>
      createBot({
        onMessage: async () => undefined,
        autoTyping: {
          intervalMs: 0
        }
      })
    ).toThrow("autoTyping.intervalMs must be a positive number.");
  });
});
