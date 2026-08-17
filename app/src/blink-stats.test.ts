import { describe, expect, it } from "vitest";
import {
  MIN_STATS_OBSERVATION_MS,
  calculateBlinkStatistics,
} from "./blink-stats";

describe("calculateBlinkStatistics", () => {
  it("waits for the minimum observation window", () => {
    expect(calculateBlinkStatistics([2_000, 7_000], 0, 10_000)).toEqual({
      rollingRate: null,
      collectingSecondsRemaining: 5,
    });
  });

  it("estimates a rolling per-minute rate from the active screen span", () => {
    const result = calculateBlinkStatistics(
      [5_000, 10_000, 15_000, 20_000, 25_000, 30_000],
      0,
      30_000,
    );

    expect(result).toEqual({
      rollingRate: 12,
      collectingSecondsRemaining: 0,
    });
  });

  it("excludes events before the current screen span", () => {
    const result = calculateBlinkStatistics(
      [10_000, 20_000, 100_000, 110_000],
      90_000,
      120_000,
    );

    expect(result.rollingRate).toBe(4);
  });

  it("reports a fresh collection window without an active screen span", () => {
    expect(
      calculateBlinkStatistics([MIN_STATS_OBSERVATION_MS], null, 30_000),
    ).toEqual({
      rollingRate: null,
      collectingSecondsRemaining: 15,
    });
  });
});
