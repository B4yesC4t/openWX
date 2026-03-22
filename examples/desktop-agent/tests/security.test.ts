import { describe, expect, it } from "vitest";

import {
  assertHasAllowedUsers,
  isAllowedUser,
  parseAllowedUsers,
  requiresConfirmation,
  resolveListPath
} from "../src/security.js";

describe("parseAllowedUsers", () => {
  it("normalizes a comma-separated whitelist", () => {
    expect([...parseAllowedUsers("alice, bob ,, carol")]).toEqual(["alice", "bob", "carol"]);
  });
});

describe("assertHasAllowedUsers", () => {
  it("rejects an empty whitelist", () => {
    expect(() => assertHasAllowedUsers(new Set())).toThrow(
      "OPENWX_ALLOWED_USERS is required for the desktop agent example."
    );
  });
});

describe("isAllowedUser", () => {
  it("matches only users in the whitelist", () => {
    const whitelist = new Set(["alice"]);

    expect(isAllowedUser("alice", whitelist)).toBe(true);
    expect(isAllowedUser("bob", whitelist)).toBe(false);
  });
});

describe("requiresConfirmation", () => {
  it("flags risky commands", () => {
    expect(requiresConfirmation("rm -rf tmp")).toBe(true);
    expect(requiresConfirmation("shutdown -h now")).toBe(true);
    expect(requiresConfirmation("pwd")).toBe(false);
  });
});

describe("resolveListPath", () => {
  it("keeps directory listing inside the configured root", () => {
    expect(resolveListPath("/tmp/openwx", "logs")).toBe("/tmp/openwx/logs");
  });

  it("rejects paths outside the configured root", () => {
    expect(() => resolveListPath("/tmp/openwx", "../secrets")).toThrow(
      "Requested path escapes OPENWX_AGENT_ROOT."
    );
  });
});
