import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createStoreScaffold, loadSyncBuf, saveSyncBuf } from "../src/store.js";

describe("createStoreScaffold", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  it("points persistence outside the repository", () => {
    expect(createStoreScaffold().accountDir).toBe("~/.openwx/accounts");
  });

  it("saves and loads sync buffers per account", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "openwx-store-"));
    tempDirs.push(tempDir);

    await saveSyncBuf("acc-1", "cursor-123", tempDir);

    await expect(loadSyncBuf("acc-1", tempDir)).resolves.toBe("cursor-123");
    await expect(loadSyncBuf("missing", tempDir)).resolves.toBeNull();
  });
});
