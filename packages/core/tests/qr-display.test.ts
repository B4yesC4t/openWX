import * as path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  DEFAULT_LOCAL_QR_FILE,
  createLocalFileQRDisplayProvider,
  createTerminalQRDisplayProvider,
  createUrlOnlyQRDisplayProvider,
  resolveQRDisplayProvider
} from "../src/qr-display.js";

describe("qr-display providers", () => {
  it("renders terminal QR codes through the generator callback", async () => {
    const logger = {
      log: vi.fn()
    };
    const generator = {
      generate: vi.fn((_text: string, _options: { small?: boolean }, callback: (output: string) => void) =>
        callback("ASCII-QR")
      )
    };

    await createTerminalQRDisplayProvider({
      generator,
      logger
    }).display("https://example.com/qr");

    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(logger.log).toHaveBeenNthCalledWith(1, "ASCII-QR");
    expect(logger.log).toHaveBeenNthCalledWith(2, "WeChat login QR URL: https://example.com/qr");
  });

  it("writes QR PNG files through the renderer", async () => {
    const logger = {
      log: vi.fn()
    };
    const renderer = {
      toFile: vi.fn(async () => undefined)
    };

    await createLocalFileQRDisplayProvider({
      outputPath: "packages/core/tests/login.png",
      renderer,
      logger
    }).display("https://example.com/qr");

    expect(renderer.toFile).toHaveBeenCalledWith(
      path.resolve("packages/core/tests/login.png"),
      "https://example.com/qr"
    );
    expect(logger.log).toHaveBeenNthCalledWith(
      1,
      `WeChat login QR saved to ${path.resolve("packages/core/tests/login.png")}`
    );
    expect(logger.log).toHaveBeenNthCalledWith(2, "WeChat login QR URL: https://example.com/qr");
  });

  it("prints only the URL when configured for logs", async () => {
    const logger = {
      log: vi.fn()
    };

    await createUrlOnlyQRDisplayProvider({
      logger
    }).display("https://example.com/qr");

    expect(logger.log).toHaveBeenCalledWith("WeChat login QR URL: https://example.com/qr");
  });

  it("resolves built-in and custom providers", async () => {
    const customProvider = {
      display: vi.fn(async () => undefined)
    };

    await resolveQRDisplayProvider(customProvider).display("https://example.com/custom");

    expect(typeof resolveQRDisplayProvider("terminal").display).toBe("function");
    expect(typeof resolveQRDisplayProvider("local-file").display).toBe("function");
    expect(resolveQRDisplayProvider(customProvider)).toBe(customProvider);
    expect(DEFAULT_LOCAL_QR_FILE).toBe("openwx-login-qrcode.png");
  });
});
