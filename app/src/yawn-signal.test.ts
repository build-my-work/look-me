import { describe, expect, it } from "vitest";
import {
  YAWN_COOLDOWN_MS,
  YAWN_MIN_OPEN_MS,
  YawnSignal,
} from "./yawn-signal";

describe("YawnSignal", () => {
  it("ignores a short mouth opening", () => {
    const signal = new YawnSignal();

    expect(signal.process({ timestamp: 0, mouthOpen: false })).toBeNull();
    expect(signal.process({ timestamp: 100, mouthOpen: true })).toBeNull();
    expect(signal.process({ timestamp: 800, mouthOpen: true })).toBeNull();
    expect(signal.process({ timestamp: 850, mouthOpen: false })).toBeNull();
  });

  it("recognizes a mouth held open for 900 milliseconds", () => {
    const signal = new YawnSignal();

    expect(signal.process({ timestamp: 0, mouthOpen: true })).toBeNull();
    expect(signal.process({ timestamp: 900, mouthOpen: true })).not.toBeNull();
  });

  it("emits once for one sustained mouth opening", () => {
    const signal = new YawnSignal();

    expect(signal.process({ timestamp: 100, mouthOpen: true })).toBeNull();
    expect(
      signal.process({
        timestamp: 100 + YAWN_MIN_OPEN_MS - 1,
        mouthOpen: true,
      }),
    ).toBeNull();
    expect(
      signal.process({ timestamp: 100 + YAWN_MIN_OPEN_MS, mouthOpen: true }),
    ).toEqual({
      detectedAt: 100 + YAWN_MIN_OPEN_MS,
      openedAt: 100,
      openDurationMs: YAWN_MIN_OPEN_MS,
    });
    expect(
      signal.process({ timestamp: 100 + YAWN_MIN_OPEN_MS + 500, mouthOpen: true }),
    ).toBeNull();
  });

  it("requires closing and a completed cooldown before another yawn", () => {
    const signal = new YawnSignal();
    const firstYawnAt = YAWN_MIN_OPEN_MS;

    signal.process({ timestamp: 0, mouthOpen: true });
    expect(
      signal.process({ timestamp: firstYawnAt, mouthOpen: true }),
    ).not.toBeNull();
    signal.process({ timestamp: firstYawnAt + 100, mouthOpen: false });

    signal.process({ timestamp: firstYawnAt + 500, mouthOpen: true });
    expect(
      signal.process({
        timestamp: firstYawnAt + 500 + YAWN_MIN_OPEN_MS,
        mouthOpen: true,
      }),
    ).toBeNull();

    signal.process({
      timestamp: firstYawnAt + YAWN_COOLDOWN_MS - 100,
      mouthOpen: false,
    });
    signal.process({
      timestamp: firstYawnAt + YAWN_COOLDOWN_MS,
      mouthOpen: true,
    });
    expect(
      signal.process({
        timestamp:
          firstYawnAt + YAWN_COOLDOWN_MS + YAWN_MIN_OPEN_MS,
        mouthOpen: true,
      }),
    ).not.toBeNull();
  });
});
