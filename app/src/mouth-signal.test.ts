import { describe, expect, it } from "vitest";
import {
  MOUTH_CLOSE_THRESHOLD,
  MOUTH_OPEN_THRESHOLD,
  MouthSignal,
} from "./mouth-signal";

describe("MouthSignal", () => {
  it("emits only open and close transitions", () => {
    const signal = new MouthSignal();

    expect(
      signal.process({ timestamp: 0, jawOpen: MOUTH_OPEN_THRESHOLD - 0.01 }),
    ).toMatchObject({ open: false, transition: null });
    expect(
      signal.process({ timestamp: 50, jawOpen: MOUTH_OPEN_THRESHOLD }),
    ).toMatchObject({ open: true, transition: "opened" });
    expect(signal.process({ timestamp: 100, jawOpen: 0.5 })).toMatchObject({
      open: true,
      transition: null,
    });
    expect(
      signal.process({ timestamp: 150, jawOpen: MOUTH_CLOSE_THRESHOLD }),
    ).toMatchObject({ open: false, transition: "closed" });
  });

  it("uses hysteresis to avoid state changes near one threshold", () => {
    const signal = new MouthSignal();
    const betweenThresholds =
      (MOUTH_OPEN_THRESHOLD + MOUTH_CLOSE_THRESHOLD) / 2;

    signal.process({ timestamp: 0, jawOpen: MOUTH_OPEN_THRESHOLD });
    expect(
      signal.process({ timestamp: 50, jawOpen: betweenThresholds }),
    ).toMatchObject({ open: true, transition: null });
    signal.process({ timestamp: 100, jawOpen: MOUTH_CLOSE_THRESHOLD });
    expect(
      signal.process({ timestamp: 150, jawOpen: betweenThresholds }),
    ).toMatchObject({ open: false, transition: null });
  });

  it("recognizes a moderate jaw-open score", () => {
    const signal = new MouthSignal();

    expect(signal.process({ timestamp: 0, jawOpen: 0.42 })).toMatchObject({
      open: true,
      transition: "opened",
    });
  });
});
