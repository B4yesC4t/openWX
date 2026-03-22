import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_LONG_POLL_TIMEOUT_MS,
  POLLING_BACKOFF_MS,
  POLLING_RETRY_DELAY_MS,
  PollingEngine,
  createPollingScaffold
} from "../src/polling.js";
import { SessionGuard } from "../src/session.js";
import type { PollOptions, PollResult } from "../src/types.js";

class MemorySyncBufferStore {
  private readonly values = new Map<string, string>();

  async loadSyncBuf(accountId: string): Promise<string | null> {
    return this.values.get(accountId) ?? null;
  }

  async saveSyncBuf(accountId: string, buf: string): Promise<void> {
    this.values.set(accountId, buf);
  }
}

describe("PollingEngine", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to the protocol long polling timeout", () => {
    expect(createPollingScaffold().timeoutMs).toBe(DEFAULT_LONG_POLL_TIMEOUT_MS);
  });

  it("loads persisted get_updates_buf, saves the next cursor, and adopts server timeout overrides", async () => {
    const store = new MemorySyncBufferStore();
    await store.saveSyncBuf("acc-1", "cursor-1");

    const firstTransport = {
      poll: vi.fn<(...args: [PollOptions?]) => Promise<PollResult>>().mockResolvedValue({
        messages: [],
        rawMessages: [],
        getUpdatesBuf: "cursor-2",
        longPollingTimeoutMs: 48_000,
        sessionExpired: false
      })
    };

    const firstEngine = new PollingEngine({
      accountId: "acc-1",
      client: firstTransport,
      store
    });

    await firstEngine.poll();

    expect(firstTransport.poll).toHaveBeenCalledWith({
      getUpdatesBuf: "cursor-1",
      timeoutMs: DEFAULT_LONG_POLL_TIMEOUT_MS
    });
    expect(await store.loadSyncBuf("acc-1")).toBe("cursor-2");

    const secondTransport = {
      poll: vi.fn<(...args: [PollOptions?]) => Promise<PollResult>>().mockResolvedValue({
        messages: [],
        rawMessages: [],
        sessionExpired: false
      })
    };

    const secondEngine = new PollingEngine({
      accountId: "acc-1",
      client: secondTransport,
      store,
      defaultTimeoutMs: 48_000
    });

    await secondEngine.poll();

    expect(secondTransport.poll).toHaveBeenCalledWith({
      getUpdatesBuf: "cursor-2",
      timeoutMs: 48_000
    });
  });

  it("retries after single failures and backs off after the third consecutive failure", async () => {
    vi.useFakeTimers();

    const transport = {
      poll: vi.fn<(...args: [PollOptions?]) => Promise<PollResult>>().mockRejectedValue(
        new Error("temporary failure")
      )
    };
    const engine = new PollingEngine({
      accountId: "acc-2",
      client: transport
    });
    const controller = new AbortController();

    const run = engine.startPolling({ signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    expect(transport.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(POLLING_RETRY_DELAY_MS - 1);
    expect(transport.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(transport.poll).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(POLLING_RETRY_DELAY_MS);
    expect(transport.poll).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(POLLING_BACKOFF_MS - 1);
    expect(transport.poll).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(1);
    expect(transport.poll).toHaveBeenCalledTimes(4);

    controller.abort();
    await run;
  });

  it("waits out the session cooldown before polling again", async () => {
    vi.useFakeTimers();

    const guard = new SessionGuard();
    const controller = new AbortController();
    const transport = {
      poll: vi.fn<(...args: [PollOptions?]) => Promise<PollResult>>().mockImplementation(async () => {
        if (transport.poll.mock.calls.length === 1) {
          guard.pause("acc-3");
          return {
            messages: [],
            rawMessages: [],
            sessionExpired: true
          };
        }

        controller.abort();
        return {
          messages: [],
          rawMessages: [],
          sessionExpired: false
        };
      })
    };
    const engine = new PollingEngine({
      accountId: "acc-3",
      client: transport,
      sessionGuard: guard
    });

    const run = engine.startPolling({ signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    expect(transport.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(59 * 60 * 1000);
    expect(transport.poll).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60 * 1000);
    expect(transport.poll).toHaveBeenCalledTimes(2);
    await run;
  });

  it("stops gracefully when aborted during a paused session", async () => {
    vi.useFakeTimers();

    const guard = new SessionGuard();
    guard.pause("acc-4");

    const transport = {
      poll: vi.fn<(...args: [PollOptions?]) => Promise<PollResult>>().mockResolvedValue({
        messages: [],
        rawMessages: [],
        sessionExpired: false
      })
    };
    const engine = new PollingEngine({
      accountId: "acc-4",
      client: transport,
      sessionGuard: guard
    });
    const controller = new AbortController();

    const run = engine.startPolling({ signal: controller.signal });
    await vi.advanceTimersByTimeAsync(0);
    expect(transport.poll).not.toHaveBeenCalled();

    controller.abort();
    await run;
  });
});
