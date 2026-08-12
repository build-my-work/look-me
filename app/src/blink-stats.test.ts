import { describe, expect, it } from "vitest";
import {
  MIN_STATS_OBSERVATION_MS,
  calculateBlinkStatistics,
} from "./blink-stats";

describe("calculateBlinkStatistics", () => {
  it("waits for a stable observation window before showing a rate", () => {
    const result = calculateBlinkStatistics([2_000, 7_000], 0, 0, 10_000);

    expect(result.rollingRate).toBeNull();
    expect(result.segmentAverage).toBeNull();
    expect(result.collectingSecondsRemaining).toBe(5);
    expect(result.totalCount).toBe(2);
  });

  it("calculates rolling and current-segment rates", () => {
    const result = calculateBlinkStatistics(
      [5_000, 10_000, 15_000, 20_000, 25_000, 30_000],
      0,
      0,
      30_000,
    );

    expect(result.rollingRate).toBe(12);
    expect(result.segmentAverage).toBe(12);
    expect(result.recentCount).toBe(6);
    expect(result.totalCount).toBe(6);
  });

  it("excludes blinks from before the current visible segment", () => {
    const now = 120_000;
    const result = calculateBlinkStatistics(
      [10_000, 20_000, 100_000, 110_000],
      0,
      90_000,
      now,
    );

    expect(result.rollingRate).toBe(4);
    expect(result.segmentAverage).toBe(4);
    expect(result.totalCount).toBe(4);
  });

  it("reports collection time when no face is visible", () => {
    const result = calculateBlinkStatistics(
      [MIN_STATS_OBSERVATION_MS],
      0,
      null,
      30_000,
    );

    expect(result.rollingRate).toBeNull();
    expect(result.recentCount).toBe(0);
    expect(result.totalCount).toBe(1);
  });
});
