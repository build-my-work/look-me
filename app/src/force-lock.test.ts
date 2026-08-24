import { describe, expect, it } from "vitest";
import {
  FORCE_LOCK_RETRY_MS,
  FORCE_LOCK_WARNING_MS,
  ForceLockTimer,
} from "./force-lock";

const MINUTE = 60 * 1_000;

function input(overrides: Partial<Parameters<ForceLockTimer["update"]>[0]> = {}) {
  return {
    now: 0,
    counting: true,
    enabled: true,
    lockCycle: 0,
    thresholdMs: 45 * MINUTE,
    ...overrides,
  };
}

describe("ForceLockTimer", () => {
  it("不计时时返回空剩余并清零", () => {
    const timer = new ForceLockTimer();
    expect(timer.update(input({ counting: false }))).toEqual({
      remainingMs: null,
      warning: false,
      due: false,
      status: "idle",
    });
    expect(timer.update(input({ enabled: false }))).toEqual({
      remainingMs: null,
      warning: false,
      due: false,
      status: "idle",
    });
  });

  it("开屏后从阈值开始倒计时", () => {
    const timer = new ForceLockTimer();
    const frame = timer.update(input({ now: 10_000 }));
    expect(frame.remainingMs).toBe(45 * MINUTE);
    expect(frame.warning).toBe(false);
    expect(frame.due).toBe(false);
    expect(frame.status).toBe("counting");

    const later = timer.update(input({ now: 10_000 + 5 * MINUTE }));
    expect(later.remainingMs).toBe(40 * MINUTE);
  });

  it("停止计时时累计清零，恢复后重新计时", () => {
    const timer = new ForceLockTimer();
    timer.update(input({ now: 0 }));
    timer.update(input({ now: 30 * MINUTE }));
    timer.update(input({ now: 31 * MINUTE, counting: false }));
    const frame = timer.update(input({ now: 32 * MINUTE }));
    expect(frame.remainingMs).toBe(45 * MINUTE);
  });

  it("最后 60 秒进入预警", () => {
    const timer = new ForceLockTimer();
    timer.update(input({ now: 0 }));
    const before = timer.update(
      input({ now: 45 * MINUTE - FORCE_LOCK_WARNING_MS - 1 }),
    );
    expect(before.warning).toBe(false);
    const inside = timer.update(
      input({ now: 45 * MINUTE - FORCE_LOCK_WARNING_MS }),
    );
    expect(inside.warning).toBe(true);
    expect(inside.due).toBe(false);
  });

  it("到点只触发一次锁屏，并在确认新的锁屏周期后重新计时", () => {
    const timer = new ForceLockTimer();
    timer.update(input({ now: 0 }));
    const due = timer.update(input({ now: 45 * MINUTE }));
    expect(due.due).toBe(true);
    expect(due.warning).toBe(true);

    const latched = timer.update(input({ now: 46 * MINUTE }));
    expect(latched.due).toBe(false);
    expect(latched.remainingMs).toBe(0);
    expect(latched.status).toBe("locking");

    const restarted = timer.update(
      input({ now: 48 * MINUTE, lockCycle: 1 }),
    );
    expect(restarted.remainingMs).toBe(45 * MINUTE);
    expect(restarted.due).toBe(false);
    expect(restarted.status).toBe("counting");
  });

  it("锁屏未确认时等待 60 秒后重试，不会永久停在零", () => {
    const timer = new ForceLockTimer();
    timer.update(input({ now: 0 }));
    timer.update(input({ now: 45 * MINUTE }));

    timer.retryAfterFailure(45 * MINUTE + 5_000);
    const retrying = timer.update(input({ now: 45 * MINUTE + 5_000 }));
    expect(retrying).toEqual({
      remainingMs: FORCE_LOCK_RETRY_MS,
      warning: true,
      due: false,
      status: "retrying",
    });

    const retried = timer.update(
      input({ now: 45 * MINUTE + 5_000 + FORCE_LOCK_RETRY_MS }),
    );
    expect(retried.remainingMs).toBe(0);
    expect(retried.due).toBe(true);
    expect(retried.status).toBe("locking");
  });
});
