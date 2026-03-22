import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export const DEFAULT_STORE_ROOT = "~/.openwx";
export const DEFAULT_STORE_DIR = DEFAULT_STORE_ROOT;
export const DEFAULT_ACCOUNTS_DIR = "~/.openwx/accounts";
export const DEFAULT_ACCOUNTS_INDEX = "~/.openwx/accounts.json";

const ACCOUNT_FILE_SUFFIX = ".json";
const SYNC_FILE_SUFFIX = ".sync.json";
const FILE_PERMISSION_MODE = 0o600;

interface SyncBufFile {
  get_updates_buf: string;
  saved_at?: string;
}

export interface StoredAccount {
  readonly token: string;
  readonly baseUrl: string;
  readonly userId: string;
  readonly savedAt: string;
}

export interface SyncBufferStore {
  loadSyncBuf(accountId: string): Promise<string | null> | string | null;
  saveSyncBuf(accountId: string, buf: string): Promise<void> | void;
}

export interface Store extends SyncBufferStore {
  saveAccount(accountId: string, data: StoredAccount): void;
  loadAccount(accountId: string): StoredAccount | null;
  listAccounts(): string[];
}

export interface FileSystemStoreOptions {
  readonly rootDir?: string;
}

export interface StoreScaffold {
  readonly packageName: "@openwx/core";
  readonly accountDir: string;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function normalizeAccountId(rawId: string): string {
  const normalized = rawId
    .trim()
    .toLowerCase()
    .replace(/^[-_.@]+|[-_.@]+$/g, "")
    .replace(/[@.]+/g, "-")
    .replace(/-{2,}/g, "-");

  if (!normalized) {
    throw new Error("Account ID cannot be empty.");
  }

  return normalized;
}

export function deriveRawAccountId(normalizedId: string): string | undefined {
  const normalized = normalizeAccountId(normalizedId);

  if (normalized.endsWith("-im-bot")) {
    return `${normalized.slice(0, -"-im-bot".length)}@im.bot`;
  }

  if (normalized.endsWith("-im-wechat")) {
    return `${normalized.slice(0, -"-im-wechat".length)}@im.wechat`;
  }

  return undefined;
}

export function expandHomeDirectory(targetPath: string): string {
  if (targetPath === "~") {
    return os.homedir();
  }

  if (targetPath.startsWith("~/")) {
    return path.join(os.homedir(), targetPath.slice(2));
  }

  return targetPath;
}

export function expandStoreDir(storeDir: string): string {
  return expandHomeDirectory(storeDir);
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
    { encoding: "utf8", mode: FILE_PERMISSION_MODE }
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

export class FileSystemStore implements Store {
  readonly rootDir: string;
  readonly accountsDir: string;
  readonly accountsIndexPath: string;

  constructor(options: FileSystemStoreOptions = {}) {
    this.rootDir = expandHomeDirectory(options.rootDir ?? DEFAULT_STORE_ROOT);
    this.accountsDir = path.join(this.rootDir, "accounts");
    this.accountsIndexPath = path.join(this.rootDir, "accounts.json");
  }

  saveAccount(accountId: string, data: StoredAccount): void {
    const normalizedAccountId = normalizeAccountId(accountId);

    this.writeJsonAtomic(this.accountPath(normalizedAccountId), data);
    this.saveAccountList(this.mergeAccountList(normalizedAccountId));
  }

  loadAccount(accountId: string): StoredAccount | null {
    const normalizedAccountId = normalizeAccountId(accountId);
    const parsed = this.readJsonFile<Record<string, unknown>>(this.accountPath(normalizedAccountId));

    if (parsed === null) {
      return null;
    }

    return {
      token: this.requireStringField(parsed, "token"),
      baseUrl: this.requireStringField(parsed, "baseUrl"),
      userId: this.requireStringField(parsed, "userId"),
      savedAt: this.requireStringField(parsed, "savedAt")
    };
  }

  saveSyncBuf(accountId: string, syncBuf: string): void {
    const normalizedAccountId = normalizeAccountId(accountId);

    this.writeJsonAtomic(this.syncPath(normalizedAccountId), {
      get_updates_buf: syncBuf
    });
  }

  loadSyncBuf(accountId: string): string | null {
    const normalizedAccountId = normalizeAccountId(accountId);
    const parsed = this.readJsonFile<Record<string, unknown>>(this.syncPath(normalizedAccountId));

    if (parsed === null) {
      return null;
    }

    const syncBuf = parsed.get_updates_buf;
    return typeof syncBuf === "string" ? syncBuf : null;
  }

  listAccounts(): string[] {
    const parsed = this.readJsonFile<unknown>(this.accountsIndexPath);

    if (!Array.isArray(parsed)) {
      return [];
    }

    const normalizedAccounts = new Set<string>();
    for (const entry of parsed) {
      if (typeof entry === "string" && entry.trim().length > 0) {
        normalizedAccounts.add(normalizeAccountId(entry));
      }
    }

    return [...normalizedAccounts].sort((left, right) => left.localeCompare(right));
  }

  private accountPath(accountId: string): string {
    return path.join(this.accountsDir, `${accountId}${ACCOUNT_FILE_SUFFIX}`);
  }

  private syncPath(accountId: string): string {
    return path.join(this.accountsDir, `${accountId}${SYNC_FILE_SUFFIX}`);
  }

  private saveAccountList(accountIds: string[]): void {
    this.writeJsonAtomic(this.accountsIndexPath, accountIds);
  }

  private mergeAccountList(accountId: string): string[] {
    const accounts = new Set(this.listAccounts());
    accounts.add(accountId);
    return [...accounts].sort((left, right) => left.localeCompare(right));
  }

  private readJsonFile<T>(filePath: string): T | null {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content) as T;
  }

  private writeJsonAtomic(filePath: string, value: unknown): void {
    this.ensureDirectory(path.dirname(filePath));

    const tempFilePath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    const serialized = `${JSON.stringify(value, null, 2)}\n`;

    fs.writeFileSync(tempFilePath, serialized, {
      encoding: "utf8",
      mode: FILE_PERMISSION_MODE
    });
    fs.renameSync(tempFilePath, filePath);
  }

  private ensureDirectory(directoryPath: string): void {
    fs.mkdirSync(directoryPath, { recursive: true });
  }

  private requireStringField(record: Record<string, unknown>, fieldName: string): string {
    const value = record[fieldName];

    if (typeof value !== "string" || value.length === 0) {
      throw new Error(`Persisted account field "${fieldName}" is missing or invalid.`);
    }

    return value;
  }
}

export function createStoreScaffold(accountDir = DEFAULT_ACCOUNTS_DIR): StoreScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Persist tokens and get_updates_buf outside the repository.",
    "Filesystem storage uses atomic rename writes for account state."
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
