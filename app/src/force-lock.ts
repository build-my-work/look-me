export const FORCE_LOCK_WARNING_MS = 60 * 1_000;
export const FORCE_LOCK_RETRY_MS = 60 * 1_000;
export const FORCE_LOCK_OVERLAY_MS = 5 * 1_000;

export type ForceLockStatus = "idle" | "counting" | "locking" | "retrying";

export interface ForceLockInput {
  now: number;
  /** 屏幕未锁定、未睡眠且处于监测时段内。 */
  counting: boolean;
  enabled: boolean;
  /** 主进程确认过的锁屏周期；变化后开始下一轮计时。 */
  lockCycle: number;
  thresholdMs: number;
}

export interface ForceLockFrame {
  /** 距锁屏的剩余毫秒；不计时时为 null。 */
  remainingMs: number | null;
  /** 进入最后 60 秒预警。 */
  warning: boolean;
  /** 到达阈值，应立即锁屏（锁屏闩住直到计时重置）。 */
  due: boolean;
  /** 最后五秒的中央提醒数字；其余时间为 null。 */
  overlaySeconds: number | null;
  status: ForceLockStatus;
}

function getOverlaySeconds(remainingMs: number): number | null {
  if (remainingMs <= 0 || remainingMs > FORCE_LOCK_OVERLAY_MS) {
    return null;
  }
  return Math.ceil(remainingMs / 1_000);
}

export class ForceLockTimer {
  private startedAt: number | null = null;
  private latched = false;
  private retryAt: number | null = null;
  private observedLockCycle: number | null = null;

  retryAfterFailure(now: number): void {
    this.startedAt = null;
    this.latched = false;
    this.retryAt = now + FORCE_LOCK_RETRY_MS;
  }

  update(input: ForceLockInput): ForceLockFrame {
    const lockCycleChanged =
      this.observedLockCycle !== null &&
      this.observedLockCycle !== input.lockCycle;
    this.observedLockCycle = input.lockCycle;
    if (lockCycleChanged) {
      this.resetTiming();
    }

    if (!input.enabled || !input.counting) {
      this.resetTiming();
      return {
        remainingMs: null,
        warning: false,
        due: false,
        overlaySeconds: null,
        status: "idle",
      };
    }

    if (this.retryAt !== null) {
      const remainingMs = this.retryAt - input.now;
      if (remainingMs <= 0) {
        this.retryAt = null;
        this.latched = true;
        return {
          remainingMs: 0,
          warning: true,
          due: true,
          overlaySeconds: null,
          status: "locking",
        };
      }
      return {
        remainingMs,
        warning: true,
        due: false,
        overlaySeconds: getOverlaySeconds(remainingMs),
        status: "retrying",
      };
    }

    this.startedAt ??= input.now;

    if (this.latched) {
      return {
        remainingMs: 0,
        warning: true,
        due: false,
        overlaySeconds: null,
        status: "locking",
      };
    }

    const remainingMs = input.thresholdMs - (input.now - this.startedAt);
    if (remainingMs <= 0) {
      this.latched = true;
      return {
        remainingMs: 0,
        warning: true,
        due: true,
        overlaySeconds: null,
        status: "locking",
      };
    }

    return {
      remainingMs,
      warning: remainingMs <= FORCE_LOCK_WARNING_MS,
      due: false,
      overlaySeconds: getOverlaySeconds(remainingMs),
      status: "counting",
    };
  }

  private resetTiming(): void {
    this.startedAt = null;
    this.latched = false;
    this.retryAt = null;
  }
}
