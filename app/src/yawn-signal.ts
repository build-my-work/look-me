export interface YawnSample {
  timestamp: number;
  mouthOpen: boolean;
}

export const YAWN_MIN_OPEN_MS = 900;
export const YAWN_COOLDOWN_MS = 8_000;

export interface YawnDetection {
  detectedAt: number;
  openedAt: number;
  openDurationMs: number;
}

export class YawnSignal {
  private openedAt: number | null = null;
  private emittedForOpening = false;
  private lastYawnAt = Number.NEGATIVE_INFINITY;

  process(sample: YawnSample): YawnDetection | null {
    if (!Number.isFinite(sample.timestamp)) {
      this.openedAt = null;
      this.emittedForOpening = false;
      return null;
    }

    if (!sample.mouthOpen) {
      this.openedAt = null;
      this.emittedForOpening = false;
      return null;
    }

    if (this.openedAt === null) {
      this.openedAt = sample.timestamp;
      return null;
    }

    if (
      this.emittedForOpening ||
      sample.timestamp - this.openedAt < YAWN_MIN_OPEN_MS
    ) {
      return null;
    }

    this.emittedForOpening = true;
    if (sample.timestamp - this.lastYawnAt < YAWN_COOLDOWN_MS) {
      return null;
    }
    this.lastYawnAt = sample.timestamp;
    return {
      detectedAt: sample.timestamp,
      openedAt: this.openedAt,
      openDurationMs: sample.timestamp - this.openedAt,
    };
  }

  reset(): void {
    this.openedAt = null;
    this.emittedForOpening = false;
    this.lastYawnAt = Number.NEGATIVE_INFINITY;
  }
}
