export const MOUTH_OPEN_THRESHOLD = 0.4;
export const MOUTH_CLOSE_THRESHOLD = 0.24;

export interface MouthSample {
  timestamp: number;
  jawOpen: number;
}

export interface MouthSignalResult {
  open: boolean;
  transition: "opened" | "closed" | null;
  timestamp: number;
  jawOpen: number;
}

export class MouthSignal {
  private open = false;

  process(sample: MouthSample): MouthSignalResult {
    if (!Number.isFinite(sample.timestamp) || !Number.isFinite(sample.jawOpen)) {
      const wasOpen = this.open;
      this.open = false;
      return {
        open: false,
        transition: wasOpen ? "closed" : null,
        timestamp: sample.timestamp,
        jawOpen: sample.jawOpen,
      };
    }

    if (!this.open && sample.jawOpen >= MOUTH_OPEN_THRESHOLD) {
      this.open = true;
      return { ...sample, open: true, transition: "opened" };
    }
    if (this.open && sample.jawOpen <= MOUTH_CLOSE_THRESHOLD) {
      this.open = false;
      return { ...sample, open: false, transition: "closed" };
    }
    return { ...sample, open: this.open, transition: null };
  }

  isOpen(): boolean {
    return this.open;
  }

  reset(): boolean {
    const wasOpen = this.open;
    this.open = false;
    return wasOpen;
  }
}
