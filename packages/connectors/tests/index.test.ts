import { describe, expect, it } from "vitest";

import {
  createClaudeCodeHandler,
  createEchoHandler,
  createHttpProxyHandler
} from "../src/index.js";

describe("@openwx/connectors", () => {
  it("re-exports the connector handler factories", () => {
    expect(createEchoHandler).toBeTypeOf("function");
    expect(createClaudeCodeHandler).toBeTypeOf("function");
    expect(createHttpProxyHandler).toBeTypeOf("function");
  });
});
