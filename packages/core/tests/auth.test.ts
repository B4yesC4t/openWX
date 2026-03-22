import * as crypto from "node:crypto";

import nock from "nock";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  createAuthScaffold,
  getLoginQRCode,
  login,
  waitForScan
} from "../src/auth.js";

describe("auth helpers", () => {
  beforeAll(() => {
    nock.disableNetConnect();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    nock.cleanAll();
  });

  it("pins the fixed bot type from the protocol", () => {
    expect(createAuthScaffold().botType).toBe("3");
  });

  it("gets the QR code from the login endpoint", async () => {
    nock("https://ilinkai.weixin.qq.com")
      .get("/cgi-bin/ilink/ilink_bot/get_bot_qrcode")
      .query({
        bot_type: "3"
      })
      .reply(200, {
        session_key: "session-1",
        qrcode_url: "https://example.com/qr.png"
      });

    await expect(getLoginQRCode()).resolves.toStrictEqual({
      sessionKey: "session-1",
      qrcodeUrl: "https://example.com/qr.png"
    });
  });

  it("polls status transitions until the QR login is confirmed", async () => {
    const sleep = vi.fn(async () => undefined);
    const onStatusChange = vi.fn();

    nock("https://ilinkai.weixin.qq.com")
      .get("/cgi-bin/ilink/ilink_bot/get_qrcode_status")
      .query({
        session_key: "session-1",
        bot_type: "3"
      })
      .reply(200, { status: 0 })
      .get("/cgi-bin/ilink/ilink_bot/get_qrcode_status")
      .query({
        session_key: "session-1",
        bot_type: "3"
      })
      .reply(200, { status: 1 })
      .get("/cgi-bin/ilink/ilink_bot/get_qrcode_status")
      .query({
        session_key: "session-1",
        bot_type: "3"
      })
      .reply(200, {
        status: 2,
        token: "bot-token",
        account_id: "demo@im.bot",
        user_id: "user@im.wechat",
        base_url: "https://example.com/"
      });

    await expect(
      waitForScan("session-1", {
        sleep,
        onStatusChange
      })
    ).resolves.toStrictEqual({
      status: "confirmed",
      token: "bot-token",
      accountId: "demo@im.bot",
      userId: "user@im.wechat",
      baseUrl: "https://example.com"
    });

    expect(sleep).toHaveBeenCalledTimes(2);
    expect(onStatusChange).toHaveBeenNthCalledWith(1, "waiting");
    expect(onStatusChange).toHaveBeenNthCalledWith(2, "scanned");
    expect(onStatusChange).toHaveBeenNthCalledWith(3, "confirmed");
  });

  it("refreshes the QR code after expiry and persists the confirmed account", async () => {
    const display = {
      display: vi.fn(async () => undefined)
    };
    const store = {
      saveAccount: vi.fn(),
      loadAccount: vi.fn(),
      saveSyncBuf: vi.fn(),
      loadSyncBuf: vi.fn(),
      listAccounts: vi.fn()
    };

    nock("https://ilinkai.weixin.qq.com")
      .get("/cgi-bin/ilink/ilink_bot/get_bot_qrcode")
      .query({
        bot_type: "3"
      })
      .reply(200, {
        session_key: "session-1",
        qrcode_url: "https://example.com/qr-1.png"
      })
      .get("/cgi-bin/ilink/ilink_bot/get_qrcode_status")
      .query({
        session_key: "session-1",
        bot_type: "3"
      })
      .reply(200, { status: "expired" })
      .get("/cgi-bin/ilink/ilink_bot/get_bot_qrcode")
      .query({
        bot_type: "3"
      })
      .reply(200, {
        session_key: "session-2",
        qrcode_url: "https://example.com/qr-2.png"
      })
      .get("/cgi-bin/ilink/ilink_bot/get_qrcode_status")
      .query({
        session_key: "session-2",
        bot_type: "3"
      })
      .reply(200, {
        status: 2,
        token: "bot-token",
        account_id: "demo@im.bot",
        user_id: "user@im.wechat",
        base_url: "https://example.com/"
      });

    await expect(
      login({
        qrDisplay: display,
        store,
        sleep: async () => undefined,
        now: () => 0
      })
    ).resolves.toStrictEqual({
      token: "bot-token",
      accountId: "demo-im-bot",
      userId: "user@im.wechat",
      baseUrl: "https://example.com",
      savedAt: "1970-01-01T00:00:00.000Z"
    });

    expect(display.display).toHaveBeenNthCalledWith(1, "https://example.com/qr-1.png");
    expect(display.display).toHaveBeenNthCalledWith(2, "https://example.com/qr-2.png");
    expect(store.saveAccount).toHaveBeenCalledWith("demo-im-bot", {
      token: "bot-token",
      baseUrl: "https://example.com",
      userId: "user@im.wechat",
      savedAt: "1970-01-01T00:00:00.000Z"
    });
  });

  it("throws a clear error after three expired QR codes", async () => {
    nock("https://ilinkai.weixin.qq.com")
      .get("/cgi-bin/ilink/ilink_bot/get_bot_qrcode")
      .times(3)
      .query({
        bot_type: "3"
      })
      .reply(200, () => ({
        session_key: crypto.randomUUID(),
        qrcode_url: "https://example.com/qr.png"
      }))
      .get("/cgi-bin/ilink/ilink_bot/get_qrcode_status")
      .times(3)
      .query((query) => query.bot_type === "3" && typeof query.session_key === "string")
      .reply(200, {
        status: "expired"
      });

    await expect(
      login({
        qrDisplay: {
          display: async () => undefined
        },
        sleep: async () => undefined
      })
    ).rejects.toThrow("QR code expired 3 times without confirmation.");
  });

  it("times out when the QR code never reaches a terminal state", async () => {
    let currentTime = 0;

    nock("https://ilinkai.weixin.qq.com")
      .get("/cgi-bin/ilink/ilink_bot/get_qrcode_status")
      .times(3)
      .query({
        session_key: "session-1",
        bot_type: "3"
      })
      .reply(200, { status: 0 });

    await expect(
      waitForScan("session-1", {
        totalTimeoutMs: 5_000,
        now: () => currentTime,
        sleep: async (durationMs) => {
          currentTime += durationMs;
        }
      })
    ).rejects.toThrow("QR login timed out after 5000ms.");
  });
});
