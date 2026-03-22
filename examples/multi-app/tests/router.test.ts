import { describe, expect, it } from "vitest";

import { HELP_COMMAND, parseHubConfig } from "../src/config.js";
import { buildHelpText, matchRoute } from "../src/router.js";

const config = parseHubConfig(`
routes:
  - prefix: /ai
    target:
      type: connector
      name: "@openwx/connector-claude-code"
  - prefix: /echo
    target:
      type: connector
      name: "@openwx/connector-echo"
defaultRoute:
  type: command
  command: show-help
`);

describe("matchRoute", () => {
  it("matches prefixed routes and strips the prefix", () => {
    expect(matchRoute("/ai explain openwx", config)).toEqual({
      target: {
        type: "connector",
        name: "@openwx/connector-claude-code"
      },
      forwardedText: "explain openwx"
    });
  });

  it("falls back to the help command for unmatched text", () => {
    expect(matchRoute("hello there", config).target).toEqual({
      type: "command",
      command: HELP_COMMAND
    });
  });
});

describe("buildHelpText", () => {
  it("lists the configured routes", () => {
    const helpText = buildHelpText(config);

    expect(helpText).toContain("/ai -> @openwx/connector-claude-code");
    expect(helpText).toContain("/echo -> @openwx/connector-echo");
    expect(helpText).toContain("默认回复");
  });
});
