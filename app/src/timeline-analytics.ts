import type { PostureState } from "./posture-signal";
import {
  type TimelineEvent,
  type TimelineEventType,
  type TimelineRange,
  sortTimelineEvents,
} from "./timeline";

const MINUTE_MS = 60_000;
const MIN_STATS_OBSERVATION_MS = 15_000;
const SECOND_MS = 1_000;
const SECOND_DETAIL_RANGE_MS = 5 * MINUTE_MS;
const TARGET_PIXELS_PER_POINT = 2;
const TIMELINE_BUCKET_STEPS_MS = [
  SECOND_MS,
  2 * SECOND_MS,
  5 * SECOND_MS,
  10 * SECOND_MS,
  15 * SECOND_MS,
  30 * SECOND_MS,
  MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  60 * MINUTE_MS,
] as const;

export interface TimelineInterval {
  spanId: string;
  sessionId: string;
  startAt: number;
  endAt: number;
}

export interface TimelineSummary {
  blinkCount: number;
  screenMs: number;
  mouthOpenMs: number;
  yawnCount: number;
  seatedMs: number;
  awayMs: number;
  standUps: number;
  averageBlinkRate: number | null;
}

export interface TimelineBucket {
  startAt: number;
  endAt: number;
  label: string;
  blinkCount: number;
  latestBlinkAt: number | null;
  screenMs: number;
  screenSeconds: number;
  mouthOpenMs: number;
  mouthSeconds: number;
  yawnCount: number;
  decisionCount: number;
  actionCount: number;
  decisionTypes: TimelineEventType[];
  actionTypes: TimelineEventType[];
  seatedMs: number;
  awayMs: number;
  standUps: number;
  hasData: boolean;
}

export interface DurationDisplay {
  value: string;
  unit: "秒" | "分钟" | "小时";
}

export function selectTimelineBucketMs(
  rangeMs: number,
  plotWidth: number,
): number {
  if (rangeMs <= SECOND_DETAIL_RANGE_MS) {
    return SECOND_MS;
  }
  const targetPointCount = Math.max(
    1,
    Math.floor(Math.max(1, plotWidth) / TARGET_PIXELS_PER_POINT),
  );
  const idealBucketMs = rangeMs / targetPointCount;
  return (
    TIMELINE_BUCKET_STEPS_MS.find((bucketMs) => bucketMs >= idealBucketMs) ??
    TIMELINE_BUCKET_STEPS_MS[TIMELINE_BUCKET_STEPS_MS.length - 1]
  );
}

function getSessionEnd(
  range: TimelineRange,
  sessionId: string,
  now: number,
): number {
  if (sessionId === range.currentSessionId) {
    return now;
  }
  const session = range.sessions.find((candidate) => candidate.id === sessionId);
  return session?.endedAt ?? session?.lastSeenAt ?? now;
}

function getSpanIntervals(
  range: TimelineRange,
  startType: TimelineEventType,
  endType: TimelineEventType,
  now: number,
): TimelineInterval[] {
  const starts = new Map<string, TimelineEvent>();
  const ends = new Map<string, TimelineEvent>();
  for (const event of range.events) {
    if (!event.spanId) {
      continue;
    }
    if (event.type === startType) {
      starts.set(event.spanId, event);
    } else if (event.type === endType) {
      ends.set(event.spanId, event);
    }
  }

  const intervals: TimelineInterval[] = [];
  for (const [spanId, start] of starts) {
    const recordedEnd = ends.get(spanId)?.at;
    const endAt = recordedEnd ?? getSessionEnd(range, start.sessionId, now);
    if (endAt > start.at) {
      intervals.push({
        spanId,
        sessionId: start.sessionId,
        startAt: start.at,
        endAt,
      });
    }
  }
  return intervals.sort((left, right) => left.startAt - right.startAt);
}

export function getScreenIntervals(
  range: TimelineRange,
  now: number,
): TimelineInterval[] {
  return getSpanIntervals(range, "screen.started", "screen.ended", now);
}

export function getMouthOpenIntervals(
  range: TimelineRange,
  now: number,
): TimelineInterval[] {
  return getSpanIntervals(range, "mouth.opened", "mouth.closed", now);
}

interface PostureInterval extends TimelineInterval {
  state: Extract<PostureState, "seated" | "away">;
}

function getPostureIntervals(
  range: TimelineRange,
  now: number,
): PostureInterval[] {
  const bySession = new Map<string, TimelineEvent[]>();
  for (const event of range.events) {
    if (event.type !== "posture.changed") {
      continue;
    }
    const current = bySession.get(event.sessionId) ?? [];
    current.push(event);
    bySession.set(event.sessionId, current);
  }

  const intervals: PostureInterval[] = [];
  for (const [sessionId, events] of bySession) {
    const sorted = sortTimelineEvents(events);
    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index];
      const state = event.data?.state;
      if (state !== "seated" && state !== "away") {
        continue;
      }
      const endAt = sorted[index + 1]?.at ?? getSessionEnd(range, sessionId, now);
      if (endAt > event.at) {
        intervals.push({
          spanId: event.id,
          sessionId,
          startAt: event.at,
          endAt,
          state,
        });
      }
    }
  }
  return intervals;
}

function overlapMs(
  startedAt: number,
  endedAt: number,
  rangeStart: number,
  rangeEnd: number,
): number {
  return Math.max(0, Math.min(endedAt, rangeEnd) - Math.max(startedAt, rangeStart));
}

function sumIntervals(
  intervals: readonly TimelineInterval[],
  from: number,
  to: number,
): number {
  return intervals.reduce(
    (total, interval) =>
      total + overlapMs(interval.startAt, interval.endAt, from, to),
    0,
  );
}

export function summarizeTimeline(
  range: TimelineRange,
  from: number,
  to: number,
  now: number,
): TimelineSummary {
  const blinkCount = range.events.filter(
    (event) => event.type === "blink.detected" && event.at >= from && event.at < to,
  ).length;
  const screenMs = sumIntervals(getScreenIntervals(range, now), from, to);
  const mouthOpenMs = sumIntervals(getMouthOpenIntervals(range, now), from, to);
  const postureIntervals = getPostureIntervals(range, now);
  const seatedMs = sumIntervals(
    postureIntervals.filter((interval) => interval.state === "seated"),
    from,
    to,
  );
  const awayMs = sumIntervals(
    postureIntervals.filter((interval) => interval.state === "away"),
    from,
    to,
  );
  const yawnCount = range.events.filter(
    (event) => event.type === "yawn.detected" && event.at >= from && event.at < to,
  ).length;
  const standUps = range.events.filter(
    (event) => event.type === "stand-up.detected" && event.at >= from && event.at < to,
  ).length;

  return {
    blinkCount,
    screenMs,
    mouthOpenMs,
    yawnCount,
    seatedMs,
    awayMs,
    standUps,
    averageBlinkRate:
      screenMs >= MIN_STATS_OBSERVATION_MS
        ? Math.round((blinkCount * MINUTE_MS) / screenMs)
        : null,
  };
}

function formatBucketLabel(timestamp: number, bucketMs: number): string {
  const date = new Date(timestamp);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  if (bucketMs >= MINUTE_MS) {
    return `${hours}:${minutes}`;
  }
  return `${hours}:${minutes}:${String(date.getSeconds()).padStart(2, "0")}`;
}

function addIntervalToBuckets(
  buckets: TimelineBucket[],
  interval: TimelineInterval,
  from: number,
  to: number,
  bucketMs: number,
  field: "screenMs" | "mouthOpenMs" | "seatedMs" | "awayMs",
): void {
  const clippedStart = Math.max(interval.startAt, from);
  const clippedEnd = Math.min(interval.endAt, to);
  if (clippedEnd <= clippedStart) {
    return;
  }
  const firstBucket = Math.floor((clippedStart - from) / bucketMs);
  const lastBucket = Math.floor((clippedEnd - 1 - from) / bucketMs);
  for (let index = firstBucket; index <= lastBucket; index += 1) {
    const bucket = buckets[index];
    if (!bucket) {
      continue;
    }
    bucket[field] += overlapMs(
      clippedStart,
      clippedEnd,
      bucket.startAt,
      bucket.endAt,
    );
    bucket.hasData = true;
  }
}

export function buildTimelineBuckets(
  range: TimelineRange,
  from: number,
  to: number,
  bucketMs: number,
  now: number,
): TimelineBucket[] {
  if (to <= from || bucketMs <= 0) {
    return [];
  }
  const buckets = Array.from(
    { length: Math.ceil((to - from) / bucketMs) },
    (_, index): TimelineBucket => {
      const startAt = from + index * bucketMs;
      return {
        startAt,
        endAt: Math.min(to, startAt + bucketMs),
        label: formatBucketLabel(startAt, bucketMs),
        blinkCount: 0,
        latestBlinkAt: null,
        screenMs: 0,
        screenSeconds: 0,
        mouthOpenMs: 0,
        mouthSeconds: 0,
        yawnCount: 0,
        decisionCount: 0,
        actionCount: 0,
        decisionTypes: [],
        actionTypes: [],
        seatedMs: 0,
        awayMs: 0,
        standUps: 0,
        hasData: false,
      };
    },
  );

  for (const interval of getScreenIntervals(range, now)) {
    addIntervalToBuckets(buckets, interval, from, to, bucketMs, "screenMs");
  }
  for (const interval of getMouthOpenIntervals(range, now)) {
    addIntervalToBuckets(buckets, interval, from, to, bucketMs, "mouthOpenMs");
  }
  for (const interval of getPostureIntervals(range, now)) {
    addIntervalToBuckets(
      buckets,
      interval,
      from,
      to,
      bucketMs,
      interval.state === "seated" ? "seatedMs" : "awayMs",
    );
  }

  for (const event of range.events) {
    if (event.at < from || event.at >= to) {
      continue;
    }
    const bucket = buckets[Math.floor((event.at - from) / bucketMs)];
    if (!bucket) {
      continue;
    }
    bucket.hasData = true;
    if (event.type === "blink.detected") {
      bucket.blinkCount += 1;
      bucket.latestBlinkAt = Math.max(bucket.latestBlinkAt ?? event.at, event.at);
    }
    if (event.type === "yawn.detected") {
      bucket.yawnCount += 1;
    }
    if (event.type === "stand-up.detected") {
      bucket.standUps += 1;
    }
    if (event.layer === "decision") {
      bucket.decisionCount += 1;
      bucket.decisionTypes.push(event.type);
    }
    if (event.layer === "action") {
      bucket.actionCount += 1;
      bucket.actionTypes.push(event.type);
    }
  }

  for (const bucket of buckets) {
    bucket.screenSeconds = bucket.screenMs / 1_000;
    bucket.mouthSeconds = bucket.mouthOpenMs / 1_000;
  }
  return buckets;
}

export function calculateDistanceObservedMs(
  range: TimelineRange,
  now: number,
): number {
  const anchorTypes: readonly TimelineEventType[] = [
    "monitoring.started",
    "distance-reminder.enabled",
    "distance-reminder.completed",
    "distance-reminder.skipped",
  ];
  const anchor = range.events
    .filter((event) => anchorTypes.includes(event.type))
    .sort((left, right) => right.at - left.at)[0];
  if (!anchor) {
    return 0;
  }
  const stopped = range.events
    .filter((event) => event.type === "monitoring.stopped")
    .sort((left, right) => right.at - left.at)[0];
  if (stopped && stopped.at >= anchor.at) {
    return 0;
  }
  return sumIntervals(getScreenIntervals(range, now), anchor.at, now);
}

export function getActiveScreenStartedAt(
  range: TimelineRange,
): number | null {
  const endedSpans = new Set(
    range.events
      .filter((event) => event.type === "screen.ended" && event.spanId)
      .map((event) => event.spanId),
  );
  const active = range.events
    .filter(
      (event) =>
        event.type === "screen.started" &&
        event.sessionId === range.currentSessionId &&
        event.spanId &&
        !endedSpans.has(event.spanId),
    )
    .sort((left, right) => right.at - left.at)[0];
  return active?.at ?? null;
}

export function getBlinkTimestamps(
  range: TimelineRange,
  from = Number.NEGATIVE_INFINITY,
  to = Number.POSITIVE_INFINITY,
): number[] {
  return range.events
    .filter(
      (event) => event.type === "blink.detected" && event.at >= from && event.at <= to,
    )
    .map((event) => event.at)
    .sort((left, right) => left - right);
}

export function formatObservedDuration(observedMs: number): DurationDisplay {
  const totalSeconds = Number.isFinite(observedMs)
    ? Math.max(0, Math.floor(observedMs / 1_000))
    : 0;
  if (totalSeconds < 60) {
    return { value: String(totalSeconds), unit: "秒" };
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) {
    return { value: String(totalMinutes), unit: "分钟" };
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return {
    value: `${hours}:${String(minutes).padStart(2, "0")}`,
    unit: "小时",
  };
}
