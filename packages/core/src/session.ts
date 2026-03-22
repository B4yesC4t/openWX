import { createScaffoldModule, type ScaffoldModule } from "./types.js";

export const SESSION_EXPIRED_CODE = -14;
export const SESSION_PAUSE_MS = 60 * 60 * 1000;

export class SessionExpiredError extends Error {
  readonly accountId: string;
  readonly remainingMs: number;
  readonly code = SESSION_EXPIRED_CODE;

  constructor(accountId: string, remainingMs: number) {
    super(`Session for account ${accountId} is paused for another ${remainingMs}ms.`);
    this.name = "SessionExpiredError";
    this.accountId = accountId;
    this.remainingMs = remainingMs;
  }
}

export class SessionGuard {
  private readonly pauseUntil = new Map<string, number>();

  pause(accountId: string): void {
    this.pauseUntil.set(accountId, Date.now() + SESSION_PAUSE_MS);
  }

  isPaused(accountId: string): boolean {
    return this.getRemainingMs(accountId) > 0;
  }

  getRemainingMs(accountId: string): number {
    const pausedUntil = this.pauseUntil.get(accountId);
    if (pausedUntil === undefined) {
      return 0;
    }

    const remainingMs = pausedUntil - Date.now();
    if (remainingMs <= 0) {
      this.pauseUntil.delete(accountId);
      return 0;
    }

    return remainingMs;
  }

  assertActive(accountId: string): void {
    const remainingMs = this.getRemainingMs(accountId);
    if (remainingMs > 0) {
      throw new SessionExpiredError(accountId, remainingMs);
    }
  }
}

export interface SessionScaffold {
  readonly packageName: "@openwx/core";
  readonly pauseMs: number;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createSessionScaffold(pauseMs = SESSION_PAUSE_MS): SessionScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Session expiry errcode -14 requires a one-hour cooldown.",
    "Use SessionGuard to block requests while the cooldown is active."
  ]);

  return {
    packageName: "@openwx/core",
    pauseMs,
    status: module.status,
    notes: module.notes
  };
}
