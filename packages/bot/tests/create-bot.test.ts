import { describe, expect, it } from "vitest";

import { createBot } from "../src/create-bot.js";

describe("createBot", () => {
  it("assembles the bot scaffold and internal core dependency", () => {
    const bot = createBot();

    expect(bot.name).toBe("openwx-bot");
    expect(bot.lifecycle.autoReconnect).toBe(true);
    expect(bot.core.auth.botType).toBe("3");
  });
});
