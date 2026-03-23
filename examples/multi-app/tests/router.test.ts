import { describe, expect, it } from "vitest";

import { parseHubConfig } from "../src/config.js";
import { buildHelpText, createExampleRouter, matchRoute } from "../src/router.js";

const config = parseHubConfig(`
routes:
  - prefix: /claude
    handler: claude-code
  - prefix: /codex
    handler: codex
  - prefix: /router
    handler: openrouter
  - prefix: /echo
    handler: echo
`);
const router = createExampleRouter(config);

describe("matchRoute", () => {
  it("matches prefixed routes and strips the prefix", () => {
    expect(matchRoute("/claude explain openwx", router)).toEqual({
      kind: "handler",
      handler: "claude-code",
      forwardedText: "explain openwx"
    });
  });

  it("falls back to the help command for unmatched text", () => {
    expect(matchRoute("hello there", router)).toEqual({
      kind: "help",
      forwardedText: "hello there"
    });
  });
});

describe("buildHelpText", () => {
  it("lists the configured routes", () => {
    const helpText = buildHelpText(config);

    expect(helpText).toContain("/claude -> claude-code");
    expect(helpText).toContain("/codex -> codex");
    expect(helpText).toContain("/router -> openrouter");
    expect(helpText).toContain("/echo -> echo");
    expect(helpText).toContain("默认回复");
  });
});
