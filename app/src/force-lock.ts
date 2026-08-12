export const FORCE_LOCK_WARNING_MS = 60 * 1_000;

export interface ForceLockInput {
  now: number;
  /** 屏幕未锁定、未睡眠且处于监测时段内。 */
  counting: boolean;
  enabled: boolean;
  thresholdMs: number;
}

export interface ForceLockFrame {
  /** 距锁屏的剩余毫秒；不计时时为 null。 */
  remainingMs: number | null;
  /** 进入最后 60 秒预警。 */
  warning: boolean;
  /** 到达阈值，应立即锁屏（锁屏闩住直到计时重置）。 */
  due: boolean;
}

export class ForceLockTimer {
  private startedAt: number | null = null;
  private latched = false;

  update(input: ForceLockInput): ForceLockFrame {
    if (!input.enabled || !input.counting) {
      this.startedAt = null;
      this.latched = false;
      return { remainingMs: null, warning: false, due: false };
    }

    this.startedAt ??= input.now;

    if (this.latched) {
      return { remainingMs: 0, warning: true, due: false };
    }

    const remainingMs = input.thresholdMs - (input.now - this.startedAt);
    if (remainingMs <= 0) {
      this.latched = true;
      return { remainingMs: 0, warning: true, due: true };
    }

    return {
      remainingMs,
      warning: remainingMs <= FORCE_LOCK_WARNING_MS,
      due: false,
    };
  }
}
