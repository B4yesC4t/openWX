import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export const DEFAULT_STORE_DIR = "~/.openwx";

interface SyncBufFile {
  get_updates_buf: string;
  saved_at: string;
}

export interface SyncBufferStore {
  loadSyncBuf(accountId: string): Promise<string | null>;
  saveSyncBuf(accountId: string, buf: string): Promise<void>;
}

export function expandStoreDir(storeDir: string): string {
  if (storeDir === "~") {
    return os.homedir();
  }

  if (storeDir.startsWith("~/")) {
    return path.join(os.homedir(), storeDir.slice(2));
  }

  return storeDir;
}

export function resolveAccountsDir(storeDir = DEFAULT_STORE_DIR): string {
  return path.join(expandStoreDir(storeDir), "accounts");
}

export function resolveSyncBufPath(accountId: string, storeDir = DEFAULT_STORE_DIR): string {
  return path.join(resolveAccountsDir(storeDir), `${accountId}.sync.json`);
}

export async function loadSyncBuf(
  accountId: string,
  storeDir = DEFAULT_STORE_DIR
): Promise<string | null> {
  try {
    const file = await readFile(resolveSyncBufPath(accountId, storeDir), "utf8");
    const parsed = JSON.parse(file) as Partial<SyncBufFile>;
    return typeof parsed.get_updates_buf === "string" ? parsed.get_updates_buf : null;
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }
}

export async function saveSyncBuf(
  accountId: string,
  buf: string,
  storeDir = DEFAULT_STORE_DIR
): Promise<void> {
  const accountsDir = resolveAccountsDir(storeDir);
  await mkdir(accountsDir, { recursive: true });
  await writeFile(
    resolveSyncBufPath(accountId, storeDir),
    JSON.stringify(
      {
        get_updates_buf: buf,
        saved_at: new Date().toISOString()
      } satisfies SyncBufFile,
      null,
      2
    ),
    { encoding: "utf8", mode: 0o600 }
  );
}

export class FileSyncBufferStore implements SyncBufferStore {
  readonly storeDir: string;

  constructor(storeDir = DEFAULT_STORE_DIR) {
    this.storeDir = storeDir;
  }

  async loadSyncBuf(accountId: string): Promise<string | null> {
    return loadSyncBuf(accountId, this.storeDir);
  }

  async saveSyncBuf(accountId: string, buf: string): Promise<void> {
    await saveSyncBuf(accountId, buf, this.storeDir);
  }
}

export interface StoreScaffold {
  readonly packageName: "@openwx/core";
  readonly accountDir: string;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createStoreScaffold(accountDir = "~/.openwx/accounts"): StoreScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Persist tokens and get_updates_buf outside the repo.",
    "Sync cursors are stored as per-account .sync.json files."
  ]);

  return {
    packageName: "@openwx/core",
    accountDir,
    status: module.status,
    notes: module.notes
  };
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
