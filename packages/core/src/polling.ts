import { createScaffoldModule, type PollOptions, type PollResult, type ScaffoldModule } from "./types.js";
import { SessionExpiredError, SessionGuard } from "./session.js";
import type { SyncBufferStore } from "./store.js";

export const DEFAULT_LONG_POLL_TIMEOUT_MS = 35_000;
export const LONG_POLL_REQUEST_GRACE_MS = 2_000;
export const POLLING_RETRY_DELAY_MS = 2_000;
export const POLLING_BACKOFF_MS = 30_000;
export const POLLING_FAILURE_THRESHOLD = 3;

export interface PollingTransport {
  poll(options?: PollOptions): Promise<PollResult>;
}

export interface PollingEngineOptions {
  readonly accountId: string;
  readonly client: PollingTransport;
  readonly store?: SyncBufferStore;
  readonly sessionGuard?: SessionGuard;
  readonly defaultTimeoutMs?: number;
  readonly retryDelayMs?: number;
  readonly backoffDelayMs?: number;
  readonly failureThreshold?: number;
}

export interface StartPollingLoopOptions {
  readonly signal?: AbortSignal;
  readonly getUpdatesBuf?: string;
  readonly timeoutMs?: number;
}

export class PollingEngine {
  private readonly accountId: string;
  private readonly client: PollingTransport;
  private readonly store: SyncBufferStore | undefined;
  private readonly sessionGuard: SessionGuard;
  private readonly retryDelayMs: number;
  private readonly backoffDelayMs: number;
  private readonly failureThreshold: number;
  private currentTimeoutMs: number;
  private currentBuf = "";
  private hydrated = false;

  constructor(options: PollingEngineOptions) {
    this.accountId = options.accountId;
    this.client = options.client;
    this.store = options.store;
    this.sessionGuard = options.sessionGuard ?? new SessionGuard();
    this.currentTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_LONG_POLL_TIMEOUT_MS;
    this.retryDelayMs = options.retryDelayMs ?? POLLING_RETRY_DELAY_MS;
    this.backoffDelayMs = options.backoffDelayMs ?? POLLING_BACKOFF_MS;
    this.failureThreshold = options.failureThreshold ?? POLLING_FAILURE_THRESHOLD;
  }

  async poll(options: PollOptions = {}): Promise<PollResult> {
    this.sessionGuard.assertActive(this.accountId);
    await this.hydrate(options.getUpdatesBuf);

    const timeoutMs = options.timeoutMs ?? this.currentTimeoutMs;
    const result = await this.client.poll({
      ...options,
      getUpdatesBuf: options.getUpdatesBuf ?? this.currentBuf,
      timeoutMs
    });

    await this.captureState(result, options.getUpdatesBuf);
    return result;
  }

  async startPolling(options: StartPollingLoopOptions = {}): Promise<void> {
    await this.hydrate(options.getUpdatesBuf);
    if (options.timeoutMs !== undefined) {
      this.currentTimeoutMs = options.timeoutMs;
    }

    let consecutiveFailures = 0;

    while (!options.signal?.aborted) {
      const remainingMs = this.sessionGuard.getRemainingMs(this.accountId);
      if (remainingMs > 0) {
        try {
          await sleep(remainingMs, options.signal);
        } catch (error) {
          if (shouldStopPolling(error, options.signal)) {
            return;
          }

          throw error;
        }
        continue;
      }

      try {
        const result = await this.poll(options.signal ? { signal: options.signal } : {});

        consecutiveFailures = 0;

        if (result.sessionExpired) {
          const pauseMs = this.sessionGuard.getRemainingMs(this.accountId);
          if (pauseMs > 0) {
            try {
              await sleep(pauseMs, options.signal);
            } catch (error) {
              if (shouldStopPolling(error, options.signal)) {
                return;
              }

              throw error;
            }
          }
        }
      } catch (error) {
        if (shouldStopPolling(error, options.signal)) {
          return;
        }

        if (error instanceof SessionExpiredError) {
          try {
            await sleep(error.remainingMs, options.signal);
          } catch (sleepError) {
            if (shouldStopPolling(sleepError, options.signal)) {
              return;
            }

            throw sleepError;
          }
          continue;
        }

        consecutiveFailures += 1;
        const delayMs =
          consecutiveFailures >= this.failureThreshold ? this.backoffDelayMs : this.retryDelayMs;
        try {
          await sleep(delayMs, options.signal);
        } catch (sleepError) {
          if (shouldStopPolling(sleepError, options.signal)) {
            return;
          }

          throw sleepError;
        }
      }
    }
  }

  private async hydrate(initialBuf?: string): Promise<void> {
    if (initialBuf !== undefined) {
      this.currentBuf = normalizeGetUpdatesBuf(initialBuf);
      this.hydrated = true;
      return;
    }

    if (this.hydrated) {
      return;
    }

    this.currentBuf = normalizeGetUpdatesBuf(await this.store?.loadSyncBuf(this.accountId));
    this.hydrated = true;
  }

  private async captureState(result: PollResult, explicitBuf?: string): Promise<void> {
    if (explicitBuf !== undefined) {
      this.currentBuf = normalizeGetUpdatesBuf(explicitBuf);
    }

    if (result.getUpdatesBuf !== undefined) {
      this.currentBuf = normalizeGetUpdatesBuf(result.getUpdatesBuf);
      await this.store?.saveSyncBuf(this.accountId, this.currentBuf);
    }

    if (result.longPollingTimeoutMs !== undefined) {
      this.currentTimeoutMs = result.longPollingTimeoutMs;
    }
  }
}

function normalizeGetUpdatesBuf(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return "";
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    return "";
  }

  return /^[A-Za-z0-9+/=]+$/.test(normalized) ? normalized : "";
}

export interface PollingScaffold {
  readonly packageName: "@openwx/core";
  readonly timeoutMs: number;
  readonly status: ScaffoldModule["status"];
  readonly notes: readonly string[];
}

export function createPollingScaffold(timeoutMs = DEFAULT_LONG_POLL_TIMEOUT_MS): PollingScaffold {
  const module = createScaffoldModule("@openwx/core", [
    "Long polling timeout defaults to 35s and can be overridden by the server.",
    "PollingEngine persists get_updates_buf and applies retry/backoff rules."
  ]);

  return {
    packageName: "@openwx/core",
    timeoutMs,
    status: module.status,
    notes: module.notes
  };
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timeoutId);
      reject(signal?.reason ?? new DOMException("Polling aborted", "AbortError"));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }

      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}

function shouldStopPolling(error: unknown, signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted && isAbortError(error));
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
