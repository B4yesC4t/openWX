import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SESSION_EXPIRED_CODE,
  SESSION_PAUSE_MS,
  SessionExpiredError,
  SessionGuard,
  createSessionScaffold
} from "../src/session.js";

describe("SessionGuard", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the one-hour cooldown in the scaffold", () => {
    expect(createSessionScaffold().pauseMs).toBe(SESSION_PAUSE_MS);
    expect(SESSION_EXPIRED_CODE).toBe(-14);
  });

  it("pauses an account, reports remaining time, and resumes after one hour", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T00:00:00.000Z"));

    const guard = new SessionGuard();

    expect(guard.isPaused("acc-1")).toBe(false);
    expect(guard.getRemainingMs("acc-1")).toBe(0);

    guard.pause("acc-1");

    expect(guard.isPaused("acc-1")).toBe(true);
    expect(guard.getRemainingMs("acc-1")).toBe(SESSION_PAUSE_MS);

    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(guard.getRemainingMs("acc-1")).toBe(45 * 60 * 1000);

    vi.advanceTimersByTime(45 * 60 * 1000);
    expect(guard.isPaused("acc-1")).toBe(false);
    expect(guard.getRemainingMs("acc-1")).toBe(0);
  });

  it("assertActive throws SessionExpiredError while paused", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-23T00:00:00.000Z"));

    const guard = new SessionGuard();
    guard.pause("acc-2");

    expect(() => guard.assertActive("acc-2")).toThrow(SessionExpiredError);
    expect(() => guard.assertActive("acc-2")).toThrow(
      "Session for account acc-2 is paused for another"
    );
  });
});
