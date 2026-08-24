import { describe, expect, it } from "vitest";
import {
  buildTimelineCountBuckets,
  getActiveScreenStartedAt,
  getActiveSeatedStartedAt,
  getBlinkTimestamps,
  getTimelineCountBucketMs,
  summarizeTimeline,
} from "./timeline-analytics";
import type {
  TimelineEvent,
  TimelineEventInput,
  TimelineRange,
  TimelineSession,
} from "./timeline";

function createRange(
  inputs: readonly TimelineEventInput[],
  session: TimelineSession = {
    id: "session",
    startedAt: 0,
    lastSeenAt: 10_000,
    endedAt: 10_000,
  },
  activeSessionId: string | null = null,
): TimelineRange {
  return {
    events: inputs.map(
      (input, index) =>
        ({
          ...input,
          id: `event-${index}`,
          sessionId: session.id,
        }) as TimelineEvent,
    ),
    sessions: [session],
    activeSessionId,
  };
}

describe("timeline analytics", () => {
  it("derives durations and stand-ups from paired boundary events", () => {
    const range = createRange([
      { at: 1_000, type: "screen.started", spanId: "screen-1" },
      { at: 6_000, type: "screen.ended", spanId: "screen-1" },
      { at: 2_000, type: "seated.started", spanId: "seated-1" },
      {
        at: 7_000,
        type: "seated.ended",
        spanId: "seated-1",
        reason: "stand_up",
      },
      { at: 8_000, type: "seated.started", spanId: "seated-2" },
      {
        at: 9_000,
        type: "seated.ended",
        spanId: "seated-2",
        reason: "tracking_lost",
      },
    ]);

    expect(summarizeTimeline(range, 0, 10_000, 10_000)).toEqual({
      screenMs: 5_000,
      seatedMs: 6_000,
      standUps: 1,
    });
  });

  it("uses fixed local-minute buckets and distinguishes coverage from zero", () => {
    const minute = new Date(2026, 7, 14, 10, 0, 0).getTime();
    const range = createRange(
      [
        { at: minute + 20_000, type: "blink.detected" },
        { at: minute + 50_000, type: "blink.detected" },
        { at: minute + 70_000, type: "yawn.detected" },
        { at: minute + 100_000, type: "blink.detected" },
        {
          at: minute + 75_000,
          type: "seated.started",
          spanId: "seated-1",
        },
        {
          at: minute + 125_000,
          type: "seated.ended",
          spanId: "seated-1",
          reason: "stand_up",
        },
      ],
      {
        id: "session",
        startedAt: minute + 15_000,
        lastSeenAt: minute + 130_000,
        endedAt: minute + 130_000,
      },
    );

    const buckets = buildTimelineCountBuckets(
      range,
      minute,
      minute + 4 * 60_000,
      minute + 4 * 60_000,
      60_000,
    );

    expect(buckets).toHaveLength(4);
    expect(buckets[0]).toMatchObject({
      startAt: minute,
      endAt: minute + 60_000,
      blinkCount: 2,
      yawnCount: 0,
      hasCoverage: true,
    });
    expect(buckets[1]).toMatchObject({
      startAt: minute + 60_000,
      endAt: minute + 2 * 60_000,
      blinkCount: 1,
      yawnCount: 1,
      sitDownCount: 0,
      standUpCount: 0,
      hasCoverage: true,
    });
    expect(buckets[2]).toMatchObject({
      startAt: minute + 2 * 60_000,
      endAt: minute + 3 * 60_000,
      standUpCount: 1,
      blinkCount: 0,
      hasCoverage: true,
    });
    expect(buckets[3]).toMatchObject({
      startAt: minute + 3 * 60_000,
      endAt: minute + 4 * 60_000,
      blinkCount: 0,
      hasCoverage: false,
    });

    const partialViewBuckets = buildTimelineCountBuckets(
      range,
      minute + 30_000,
      minute + 90_000,
      minute + 4 * 60_000,
      60_000,
    );
    expect(
      partialViewBuckets.map(({ blinkCount, yawnCount }) => ({
        blinkCount,
        yawnCount,
      })),
    ).toEqual([
      { blinkCount: 1, yawnCount: 0 },
      { blinkCount: 0, yawnCount: 1 },
    ]);
  });

  it("counts a sit-down only after a confirmed stand-up in the same session", () => {
    const minute = new Date(2026, 7, 14, 10, 0, 0).getTime();
    const range = createRange(
      [
        { at: minute + 5_000, type: "seated.started", spanId: "seated-1" },
        {
          at: minute + 15_000,
          type: "seated.ended",
          spanId: "seated-1",
          reason: "stand_up",
        },
        { at: minute + 25_000, type: "seated.started", spanId: "seated-2" },
        {
          at: minute + 35_000,
          type: "seated.ended",
          spanId: "seated-2",
          reason: "tracking_lost",
        },
        { at: minute + 45_000, type: "seated.started", spanId: "seated-3" },
      ],
      {
        id: "session",
        startedAt: minute,
        lastSeenAt: minute + 60_000,
        endedAt: minute + 60_000,
      },
    );

    const [bucket] = buildTimelineCountBuckets(
      range,
      minute,
      minute + 60_000,
      minute + 60_000,
      60_000,
    );

    expect(bucket.sitDownCount).toBe(1);
  });

  it("pairs a sit-down with a stand-up before the visible day", () => {
    const midnight = new Date(2026, 7, 15, 0, 0, 0).getTime();
    const range = createRange(
      [
        {
          at: midnight - 30_000,
          type: "seated.ended",
          spanId: "seated-1",
          reason: "stand_up",
        },
        {
          at: midnight + 30_000,
          type: "seated.started",
          spanId: "seated-2",
        },
      ],
      {
        id: "session",
        startedAt: midnight - 60_000,
        lastSeenAt: midnight + 60_000,
        endedAt: midnight + 60_000,
      },
    );

    const [bucket] = buildTimelineCountBuckets(
      range,
      midnight,
      midnight + 60_000,
      midnight + 60_000,
      60_000,
    );

    expect(bucket).toMatchObject({ sitDownCount: 1, standUpCount: 0 });
  });

  it("aggregates counts into aligned multi-minute buckets", () => {
    const minute = new Date(2026, 7, 14, 10, 0, 0).getTime();
    const range = createRange(
      [
        { at: minute + 20_000, type: "blink.detected" },
        { at: minute + 4 * 60_000 + 59_000, type: "blink.detected" },
        { at: minute + 5 * 60_000, type: "blink.detected" },
      ],
      {
        id: "session",
        startedAt: minute,
        lastSeenAt: minute + 10 * 60_000,
        endedAt: minute + 10 * 60_000,
      },
    );

    const buckets = buildTimelineCountBuckets(
      range,
      minute,
      minute + 10 * 60_000,
      minute + 10 * 60_000,
      5 * 60_000,
    );

    expect(
      buckets.map(({ startAt, endAt, blinkCount }) => ({
        startOffset: startAt - minute,
        endOffset: endAt - minute,
        blinkCount,
      })),
    ).toEqual([
      { startOffset: 0, endOffset: 5 * 60_000, blinkCount: 2 },
      { startOffset: 5 * 60_000, endOffset: 10 * 60_000, blinkCount: 1 },
    ]);
  });

  it("chooses a nice count interval from duration and plot width", () => {
    expect(getTimelineCountBucketMs(60 * 60_000, 740)).toBe(60_000);
    expect(getTimelineCountBucketMs(6 * 60 * 60_000, 740)).toBe(5 * 60_000);
    expect(getTimelineCountBucketMs(24 * 60 * 60_000, 740)).toBe(30 * 60_000);
    expect(getTimelineCountBucketMs(24 * 60 * 60_000, 320)).toBe(60 * 60_000);
  });

  it("keeps raw bucket bounds when a bucket crosses midnight", () => {
    const midnight = new Date(2026, 7, 15, 0, 0, 0).getTime();
    const range = createRange([], {
      id: "session",
      startedAt: midnight,
      lastSeenAt: midnight + 24 * 60 * 60_000,
      endedAt: midnight + 24 * 60 * 60_000,
    });

    const [bucket] = buildTimelineCountBuckets(
      range,
      midnight,
      midnight + 24 * 60 * 60_000,
      midnight + 24 * 60 * 60_000,
      24 * 60 * 60_000,
    );

    expect(bucket.startAt).toBe(midnight);
    expect(bucket.endAt).toBe(midnight + 24 * 60 * 60_000);
  });

  it("closes active spans at now and exposes their start times", () => {
    const range = createRange(
      [
        { at: 1_000, type: "screen.started", spanId: "screen-1" },
        { at: 2_000, type: "seated.started", spanId: "seated-1" },
      ],
      { id: "session", startedAt: 0, lastSeenAt: 2_000 },
      "session",
    );

    expect(summarizeTimeline(range, 0, 10_000, 5_000)).toMatchObject({
      screenMs: 4_000,
      seatedMs: 3_000,
    });
    expect(getActiveScreenStartedAt(range)).toBe(1_000);
    expect(getActiveSeatedStartedAt(range)).toBe(2_000);
  });

  it("closes interrupted historical spans at the last heartbeat", () => {
    const range = createRange(
      [{ at: 1_000, type: "screen.started", spanId: "screen-1" }],
      { id: "session", startedAt: 0, lastSeenAt: 4_000 },
    );

    expect(summarizeTimeline(range, 0, 10_000, 12_000).screenMs).toBe(3_000);
    expect(getActiveScreenStartedAt(range)).toBeNull();
  });

  it("does not extend a historical span when its session record is missing", () => {
    const range = createRange(
      [{ at: 1_000, type: "screen.started", spanId: "screen-1" }],
      { id: "session", startedAt: 0, lastSeenAt: 4_000 },
    );
    range.sessions = [];

    expect(summarizeTimeline(range, 5_000, 10_000, 10_000).screenMs).toBe(0);
  });

  it("uses a half-open range when selecting blink timestamps", () => {
    const range = createRange([
      { at: 1_000, type: "blink.detected" },
      { at: 2_000, type: "blink.detected" },
    ]);

    expect(getBlinkTimestamps(range, 1_000, 2_000)).toEqual([1_000]);
  });
});
