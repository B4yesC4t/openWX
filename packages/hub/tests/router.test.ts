import { describe, expect, it, vi } from "vitest";

import { createRouter, detectRouteConflicts } from "../src/router.js";

describe("Router", () => {
  it("routes prefix matches and strips the command prefix", () => {
    const router = createRouter({
      routes: [
        { prefix: "/ai", handler: "claude-code" },
        { default: true, handler: "echo" }
      ]
    });

    const match = router.resolve({
      userId: "user-1",
      text: "/ai explain this"
    });

    expect(match?.routeIndex).toBe(0);
    expect(match?.request.text).toBe("explain this");
    expect(match?.request.conversationId).toBe("user-1");
  });

  it("supports keyword, user whitelist, regex, and default fallback in registration order", () => {
    const router = createRouter({
      routes: [
        { users: ["vip-user"], handler: "claude-code" },
        { keywords: ["echo"], handler: "echo" },
        { pattern: "^/http\\b", handler: "http-proxy" },
        { default: true, handler: "echo" }
      ]
    });

    expect(
      router.resolve({
        userId: "vip-user",
        text: "echo this"
      })?.route.handler
    ).toBe("claude-code");

    expect(
      router.resolve({
        userId: "user-2",
        text: "please echo this"
      })?.route.handler
    ).toBe("echo");

    expect(
      router.resolve({
        userId: "user-3",
        text: "/http ping"
      })?.route.handler
    ).toBe("http-proxy");

    expect(
      router.resolve({
        userId: "user-4",
        text: "plain text"
      })?.route.handler
    ).toBe("echo");
  });

  it("does not treat partial prefix overlaps as matches", () => {
    const router = createRouter({
      routes: [{ prefix: "/ai", handler: "claude-code" }]
    });

    const match = router.resolve({
      userId: "user-1",
      text: "/aix test"
    });

    expect(match).toBeNull();
  });

  it("rejects unsafe regular expressions even when router config is created programmatically", () => {
    expect(() =>
      createRouter({
        routes: [{ pattern: "(a+)+$", handler: "echo" }]
      })
    ).toThrow(/unsafe regular expression/i);
  });

  it("dispatches through the connector assigned to the matched route", async () => {
    const router = createRouter({
      routes: [
        { prefix: "/echo", handler: "echo" },
        { default: true, handler: "http-proxy" }
      ]
    });
    const echoHandle = vi.fn().mockResolvedValue({ text: "Echo: hi" });
    const defaultHandle = vi.fn().mockResolvedValue({ text: "fallback" });

    const response = await router.dispatch(
      {
        userId: "user-1",
        text: "/echo hi"
      },
      new Map([
        [0, { id: "echo", handle: echoHandle }],
        [1, { id: "fallback", handle: defaultHandle }]
      ])
    );

    expect(response?.text).toBe("Echo: hi");
    expect(echoHandle).toHaveBeenCalledWith({
      conversationId: "user-1",
      text: "hi"
    });
    expect(defaultHandle).not.toHaveBeenCalled();
  });

  it("warns about overlapping routes during startup", () => {
    const warn = vi.fn();
    const warnings = detectRouteConflicts([
      { prefix: "/ai", handler: "claude-code" },
      { prefix: "/ai", handler: "echo" },
      { default: true, handler: "echo" },
      { keywords: ["echo"], handler: "http-proxy" }
    ]);

    expect(warnings).toContain('Routes #1 and #2 share the same prefix "/ai".');
    expect(warnings).toContain(
      "Route #3 is a default route but is not last; later routes will never match."
    );

    createRouter(
      {
        routes: [
          { prefix: "/ai", handler: "claude-code" },
          { prefix: "/ai", handler: "echo" }
        ]
      },
      {
        logger: { warn }
      }
    );

    expect(warn).toHaveBeenCalledWith('Routes #1 and #2 share the same prefix "/ai".');
  });
});
