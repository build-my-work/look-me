import { describe, expect, it } from "vitest";
import {
  buildTimelineBuckets,
  calculateDistanceObservedMs,
  selectTimelineBucketMs,
  summarizeTimeline,
} from "./timeline-analytics";
import type {
  TimelineEvent,
  TimelineEventInput,
  TimelineRange,
} from "./timeline";

function createRange(
  inputs: readonly TimelineEventInput[],
  currentSessionId = "session",
): TimelineRange {
  const events = inputs.map<TimelineEvent>((input, index) => ({
    ...input,
    id: `event-${index}`,
    sessionId: currentSessionId,
  }));
  return {
    events,
    sessions: [
      {
        id: currentSessionId,
        startedAt: Math.min(...events.map((event) => event.at), 0),
        lastSeenAt: Math.max(...events.map((event) => event.at), 0),
      },
    ],
    currentSessionId,
  };
}

describe("timeline analytics", () => {
  it("selects a pixel-aware natural bucket without losing second detail", () => {
    expect(selectTimelineBucketMs(5 * 60_000, 320)).toBe(1_000);
    expect(selectTimelineBucketMs(6 * 60_000, 800)).toBe(1_000);
    expect(selectTimelineBucketMs(60 * 60_000, 800)).toBe(10_000);
    expect(selectTimelineBucketMs(24 * 60 * 60_000, 800)).toBe(5 * 60_000);
    expect(selectTimelineBucketMs(24 * 60 * 60_000, 1_600)).toBe(2 * 60_000);
  });

  it("derives exact minute aggregates from sparse facts", () => {
    const minute = new Date(2026, 7, 14, 10, 0, 0).getTime();
    const range = createRange([
      {
        at: minute + 20_200,
        layer: "fact",
        type: "screen.started",
        spanId: "screen-1",
      },
      { at: minute + 40_100, layer: "fact", type: "blink.detected" },
      { at: minute + 40_600, layer: "fact", type: "blink.detected" },
      { at: minute + 40_800, layer: "decision", type: "yawn.detected" },
      {
        at: minute + 58_000,
        layer: "fact",
        type: "mouth.opened",
        spanId: "mouth-1",
      },
      {
        at: minute + 70_500,
        layer: "fact",
        type: "screen.ended",
        spanId: "screen-1",
      },
      {
        at: minute + 62_000,
        layer: "fact",
        type: "mouth.closed",
        spanId: "mouth-1",
      },
    ]);

    const buckets = buildTimelineBuckets(
      range,
      minute,
      minute + 120_000,
      60_000,
      minute + 120_000,
    );

    expect(buckets[0]).toMatchObject({
      blinkCount: 2,
      yawnCount: 1,
      latestBlinkAt: minute + 40_600,
      screenMs: 39_800,
      mouthOpenMs: 2_000,
    });
    expect(buckets[1]).toMatchObject({
      blinkCount: 0,
      latestBlinkAt: null,
      screenMs: 10_500,
      mouthOpenMs: 2_000,
    });
  });

  it("keeps second buckets consistent with their minute aggregate", () => {
    const minute = new Date(2026, 7, 14, 10, 31, 0).getTime();
    const range = createRange([
      {
        at: minute + 10_250,
        layer: "fact",
        type: "screen.started",
        spanId: "screen-1",
      },
      { at: minute + 42_300, layer: "fact", type: "blink.detected" },
      { at: minute + 42_500, layer: "decision", type: "yawn.detected" },
      {
        at: minute + 41_360,
        layer: "fact",
        type: "mouth.opened",
        spanId: "mouth-1",
      },
      {
        at: minute + 42_000,
        layer: "fact",
        type: "mouth.closed",
        spanId: "mouth-1",
      },
      {
        at: minute + 58_900,
        layer: "fact",
        type: "screen.ended",
        spanId: "screen-1",
      },
    ]);
    const minuteBucket = buildTimelineBuckets(
      range,
      minute,
      minute + 60_000,
      60_000,
      minute + 60_000,
    )[0];
    const seconds = buildTimelineBuckets(
      range,
      minute,
      minute + 60_000,
      1_000,
      minute + 60_000,
    );

    expect(seconds[42]).toMatchObject({
      blinkCount: 1,
      yawnCount: 1,
      latestBlinkAt: minute + 42_300,
      screenMs: 1_000,
    });
    expect(seconds[41].mouthOpenMs).toBe(640);
    expect(seconds.reduce((total, point) => total + point.blinkCount, 0)).toBe(
      minuteBucket.blinkCount,
    );
    expect(seconds.reduce((total, point) => total + point.yawnCount, 0)).toBe(
      minuteBucket.yawnCount,
    );
    expect(seconds.reduce((total, point) => total + point.screenMs, 0)).toBe(
      minuteBucket.screenMs,
    );
    expect(seconds.reduce((total, point) => total + point.mouthOpenMs, 0)).toBe(
      minuteBucket.mouthOpenMs,
    );
  });

  it("closes a dangling span at the current session time", () => {
    const range = createRange([
      { at: 1_000, layer: "fact", type: "screen.started", spanId: "screen-1" },
    ]);

    expect(summarizeTimeline(range, 0, 10_000, 4_500).screenMs).toBe(3_500);
  });

  it("uses the last session heartbeat for an interrupted prior session", () => {
    const range: TimelineRange = {
      events: [
        {
          id: "event-1",
          sessionId: "old-session",
          at: 1_000,
          layer: "fact",
          type: "screen.started",
          spanId: "screen-1",
        },
      ],
      sessions: [
        { id: "old-session", startedAt: 0, lastSeenAt: 4_000 },
        { id: "current-session", startedAt: 10_000, lastSeenAt: 10_000 },
      ],
      currentSessionId: "current-session",
    };

    expect(summarizeTimeline(range, 0, 10_000, 12_000).screenMs).toBe(3_000);
  });

  it("accumulates screen time only after the latest distance-cycle anchor", () => {
    const range = createRange([
      { at: 0, layer: "fact", type: "monitoring.started" },
      {
        at: 1_000,
        layer: "fact",
        type: "screen.started",
        spanId: "screen-1",
      },
      {
        at: 11_000,
        layer: "fact",
        type: "screen.ended",
        spanId: "screen-1",
      },
      { at: 12_000, layer: "action", type: "distance-reminder.skipped" },
      {
        at: 20_000,
        layer: "fact",
        type: "screen.started",
        spanId: "screen-2",
      },
      {
        at: 26_500,
        layer: "fact",
        type: "screen.ended",
        spanId: "screen-2",
      },
    ]);

    expect(calculateDistanceObservedMs(range, 30_000)).toBe(6_500);
  });
});
