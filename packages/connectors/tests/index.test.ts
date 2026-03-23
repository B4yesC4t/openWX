import { describe, expect, it } from "vitest";

import {
  createClaudeCodeConnector,
  createClaudeCodeHandler,
  createCodexConnector,
  createCodexHandler,
  createEchoConnector,
  createEchoHandler,
  createHttpProxyConnector,
  createHttpProxyHandler,
  createOpenRouterConnector,
  createOpenRouterHandler
} from "../src/index.js";

describe("@openwx/connectors", () => {
  it("re-exports the connector and handler factories", () => {
    expect(createEchoConnector).toBeTypeOf("function");
    expect(createEchoHandler).toBeTypeOf("function");
    expect(createClaudeCodeConnector).toBeTypeOf("function");
    expect(createClaudeCodeHandler).toBeTypeOf("function");
    expect(createCodexConnector).toBeTypeOf("function");
    expect(createCodexHandler).toBeTypeOf("function");
    expect(createHttpProxyConnector).toBeTypeOf("function");
    expect(createHttpProxyHandler).toBeTypeOf("function");
    expect(createOpenRouterConnector).toBeTypeOf("function");
    expect(createOpenRouterHandler).toBeTypeOf("function");
  });
});
