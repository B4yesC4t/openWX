import { describe, expect, it } from "vitest";

import { parseHubConfig } from "../src/config.js";
import { buildHelpText, createExampleRouter, matchRoute } from "../src/router.js";

const config = parseHubConfig(`
routes:
  - prefix: /ai
    handler: claude-code
  - prefix: /echo
    handler: echo
`);
const router = createExampleRouter(config);

describe("matchRoute", () => {
  it("matches prefixed routes and strips the prefix", () => {
    expect(matchRoute("/ai explain openwx", router)).toEqual({
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

    expect(helpText).toContain("/ai -> claude-code");
    expect(helpText).toContain("/echo -> echo");
    expect(helpText).toContain("默认回复");
  });
});
