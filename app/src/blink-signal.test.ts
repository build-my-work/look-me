import { describe, expect, it } from "vitest";
import { BlinkSignal } from "./blink-signal";

describe("BlinkSignal", () => {
  it("emits one blink for a balanced open-close-open sequence", () => {
    const signal = new BlinkSignal();

    expect(signal.process({ timestamp: 0, leftBlend: 0.05, rightBlend: 0.06, ear: 0.3 })).toBe(false);
    expect(signal.process({ timestamp: 100, leftBlend: 0.76, rightBlend: 0.79, ear: 0.13 })).toBe(false);
    expect(signal.process({ timestamp: 130, leftBlend: 0.82, rightBlend: 0.81, ear: 0.11 })).toBe(false);
    expect(signal.process({ timestamp: 180, leftBlend: 0.06, rightBlend: 0.05, ear: 0.3 })).toBe(true);
    expect(signal.getLastDetection()).toEqual({
      closedAt: 100,
      openedAt: 180,
      closedDurationMs: 80,
      peakLeftBlend: 0.82,
      peakRightBlend: 0.81,
      minimumEar: 0.11,
    });
  });

  it("accepts an attenuated distant-face closure when EAR strongly confirms it", () => {
    const signal = new BlinkSignal();

    signal.process({ timestamp: 0, leftBlend: 0.05, rightBlend: 0.06, ear: 0.3 });
    signal.process({ timestamp: 50, leftBlend: 0.06, rightBlend: 0.07, ear: 0.29 });
    expect(signal.process({ timestamp: 100, leftBlend: 0.36, rightBlend: 0.39, ear: 0.15 })).toBe(false);
    expect(signal.process({ timestamp: 170, leftBlend: 0.06, rightBlend: 0.05, ear: 0.3 })).toBe(true);
  });

  it("does not treat weak distant-face noise as a blink without an EAR drop", () => {
    const signal = new BlinkSignal();

    signal.process({ timestamp: 0, leftBlend: 0.05, rightBlend: 0.06, ear: 0.3 });
    expect(signal.process({ timestamp: 100, leftBlend: 0.36, rightBlend: 0.39, ear: 0.24 })).toBe(false);
    expect(signal.process({ timestamp: 170, leftBlend: 0.06, rightBlend: 0.05, ear: 0.3 })).toBe(false);
  });

  it("ignores a wink", () => {
    const signal = new BlinkSignal();

    signal.process({ timestamp: 0, leftBlend: 0.04, rightBlend: 0.05 });
    signal.process({ timestamp: 100, leftBlend: 0.9, rightBlend: 0.05 });
    expect(signal.process({ timestamp: 180, leftBlend: 0.05, rightBlend: 0.05 })).toBe(false);
  });

  it("ignores an extended eye closure", () => {
    const signal = new BlinkSignal();

    signal.process({ timestamp: 0, leftBlend: 0.05, rightBlend: 0.05 });
    signal.process({ timestamp: 100, leftBlend: 0.9, rightBlend: 0.9 });
    expect(signal.process({ timestamp: 1_000, leftBlend: 0.05, rightBlend: 0.05 })).toBe(false);
  });
});
