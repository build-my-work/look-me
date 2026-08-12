import { describe, expect, it } from "vitest";
import {
  createBlinkHistory,
  formatLocalDateKey,
  getDaySeries,
  getLocalMinuteIndex,
  parseBlinkHistory,
  pruneBlinkHistory,
  recordBlink,
  recordObservedInterval,
  shiftLocalDateKey,
  summarizeDay,
} from "./blink-history";

describe("blink history", () => {
  it("normalizes a partially observed minute into blinks per minute", () => {
    const startedAt = new Date(2026, 7, 12, 9, 30, 0).getTime();
    let history = recordObservedInterval(
      createBlinkHistory(),
      startedAt,
      startedAt + 30_000,
    );
    history = recordBlink(history, startedAt + 5_000);
    history = recordBlink(history, startedAt + 15_000);

    const point = getDaySeries(history, formatLocalDateKey(startedAt))[
      getLocalMinuteIndex(startedAt)
    ];
    expect(point.rate).toBe(4);
    expect(point.blinkCount).toBe(2);
    expect(point.observedMs).toBe(30_000);
  });

  it("keeps unobserved and under-observed minutes as gaps", () => {
    const startedAt = new Date(2026, 7, 12, 9, 30, 0).getTime();
    const history = recordObservedInterval(
      createBlinkHistory(),
      startedAt,
      startedAt + 10_000,
    );
    const series = getDaySeries(history, formatLocalDateKey(startedAt));

    expect(series[getLocalMinuteIndex(startedAt)].rate).toBeNull();
    expect(series[getLocalMinuteIndex(startedAt) + 1].rate).toBeNull();
  });

  it("splits observation duration at a minute boundary", () => {
    const startedAt = new Date(2026, 7, 12, 9, 30, 50).getTime();
    const history = recordObservedInterval(
      createBlinkHistory(),
      startedAt,
      startedAt + 30_000,
    );
    const series = getDaySeries(history, formatLocalDateKey(startedAt));
    const minuteIndex = getLocalMinuteIndex(startedAt);

    expect(series[minuteIndex].observedMs).toBe(10_000);
    expect(series[minuteIndex + 1].observedMs).toBe(20_000);
  });

  it("stores an interval that crosses midnight on the correct local dates", () => {
    const startedAt = new Date(2026, 7, 12, 23, 59, 50).getTime();
    const history = recordObservedInterval(
      createBlinkHistory(),
      startedAt,
      startedAt + 30_000,
    );

    expect(history.days["2026-08-12"]["1439"].observedMs).toBe(10_000);
    expect(history.days["2026-08-13"]["0"].observedMs).toBe(20_000);
  });

  it("summarizes the selected day using valid observed time", () => {
    const startedAt = new Date(2026, 7, 12, 9, 30, 0).getTime();
    let history = recordObservedInterval(
      createBlinkHistory(),
      startedAt,
      startedAt + 30_000,
    );
    for (let index = 0; index < 6; index += 1) {
      history = recordBlink(history, startedAt + index * 4_000);
    }

    expect(summarizeDay(history, formatLocalDateKey(startedAt))).toEqual({
      totalBlinks: 6,
      observedMinutes: 1,
      validMinuteCount: 1,
      averageRate: 12,
    });
  });

  it("retains today and the previous 29 local dates", () => {
    const todayKey = "2026-08-12";
    const history = {
      version: 1 as const,
      days: {
        "2026-07-13": { "0": { blinks: 1, observedMs: 60_000 } },
        "2026-07-14": { "0": { blinks: 2, observedMs: 60_000 } },
        "2026-08-12": { "0": { blinks: 3, observedMs: 60_000 } },
        "2026-08-13": { "0": { blinks: 4, observedMs: 60_000 } },
      },
    };

    expect(Object.keys(pruneBlinkHistory(history, todayKey).days)).toEqual([
      "2026-07-14",
      "2026-08-12",
    ]);
  });

  it("switches dates across month boundaries", () => {
    expect(shiftLocalDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftLocalDateKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("recovers safely from malformed persisted data", () => {
    expect(parseBlinkHistory("not-json")).toEqual(createBlinkHistory());
    expect(parseBlinkHistory('{"version":2,"days":{}}')).toEqual(
      createBlinkHistory(),
    );
  });
});
