import * as fs from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import * as path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FileSystemStore,
  createStoreScaffold,
  deriveRawAccountId,
  loadSyncBuf,
  normalizeAccountId,
  saveSyncBuf
} from "../src/store.js";

const createdRoots: string[] = [];
const tempDirs: string[] = [];

function createTestStoreRoot(): string {
  const tempRoot = fs.mkdtempSync(path.join(process.cwd(), "tests/tmp-store-"));
  createdRoots.push(tempRoot);
  return tempRoot;
}

describe("store", () => {
  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));

    for (const rootPath of createdRoots.splice(0)) {
      if (fs.existsSync(rootPath)) {
        fs.rmSync(rootPath, {
          recursive: true,
          force: true
        });
      }
    }

    vi.restoreAllMocks();
  });

  it("points persistence outside the repository by default", () => {
    expect(createStoreScaffold().accountDir).toBe("~/.openwx/accounts");
  });

  it("saves and loads standalone sync buffers", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openwx-store-"));
    tempDirs.push(tempDir);

    await saveSyncBuf("acc-1", "cursor-123", tempDir);

    await expect(loadSyncBuf("acc-1", tempDir)).resolves.toBe("cursor-123");
    await expect(loadSyncBuf("missing", tempDir)).resolves.toBeNull();
  });

  it("normalizes account IDs and can derive known raw forms", () => {
    expect(normalizeAccountId(" Demo@im.bot ")).toBe("demo-im-bot");
    expect(deriveRawAccountId("demo-im-bot")).toBe("demo@im.bot");
    expect(deriveRawAccountId("demo-im-wechat")).toBe("demo@im.wechat");
  });

  it("saves, loads, and lists persisted accounts", () => {
    const store = new FileSystemStore({
      rootDir: createTestStoreRoot()
    });

    store.saveAccount("Demo@im.bot", {
      token: "bot-token",
      baseUrl: "https://example.com",
      userId: "user@im.wechat",
      savedAt: "2026-03-23T00:00:00.000Z"
    });

    expect(store.loadAccount("demo-im-bot")).toStrictEqual({
      token: "bot-token",
      baseUrl: "https://example.com",
      userId: "user@im.wechat",
      savedAt: "2026-03-23T00:00:00.000Z"
    });
    expect(store.listAccounts()).toStrictEqual(["demo-im-bot"]);
  });

  it("saves and loads get_updates_buf data", () => {
    const store = new FileSystemStore({
      rootDir: createTestStoreRoot()
    });

    store.saveSyncBuf("demo@im.bot", "cursor-123");

    expect(store.loadSyncBuf("demo-im-bot")).toBe("cursor-123");
  });

  it("creates missing directories and writes through atomic rename", () => {
    const rootDir = path.join(createTestStoreRoot(), "nested", "openwx");
    const store = new FileSystemStore({
      rootDir
    });

    store.saveAccount("demo@im.bot", {
      token: "bot-token",
      baseUrl: "https://example.com",
      userId: "user@im.wechat",
      savedAt: "2026-03-23T00:00:00.000Z"
    });

    expect(fs.existsSync(path.join(rootDir, "accounts", "demo-im-bot.json"))).toBe(true);
    expect(fs.existsSync(path.join(rootDir, "accounts.json"))).toBe(true);
    expect(
      fs
        .readdirSync(path.join(rootDir, "accounts"))
        .some((fileName) => fileName.endsWith(".tmp"))
    ).toBe(false);
  });
});
