import { describe, expect, it } from "vitest";

import { createBot, parseCommand } from "../src/index.js";
import { FakeClient } from "./test-helpers.js";

describe("bot index", () => {
  it("re-exports createBot and handler helpers", () => {
    const client = new FakeClient("bot-token");
    const bot = createBot(
      {
        onMessage: async () => "pong"
      },
      {
        clientFactory: () => client,
        handleProcessSignals: false
      }
    );

    expect(bot.client).toBe(client);
    expect(parseCommand("/help")).toStrictEqual({
      command: "/help",
      args: []
    });
  });
});
