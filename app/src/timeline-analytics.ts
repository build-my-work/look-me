import {
  type TimelineEvent,
  type TimelineEventType,
  type TimelineRange,
} from "./timeline";

const MINUTE_MS = 60_000;
const COUNT_POINT_SPACING_PX = 10;
const COUNT_BUCKET_INTERVALS_MS = [
  MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  60 * MINUTE_MS,
  2 * 60 * MINUTE_MS,
  3 * 60 * MINUTE_MS,
  6 * 60 * MINUTE_MS,
  12 * 60 * MINUTE_MS,
  24 * 60 * MINUTE_MS,
] as const;
type SpanTimelineEvent = Extract<TimelineEvent, { spanId: string }>;

function hasSpanId(event: TimelineEvent): event is SpanTimelineEvent {
  return "spanId" in event;
}

export interface TimelineInterval {
  spanId: string;
  sessionId: string;
  startAt: number;
  endAt: number;
}

export interface TimelineSummary {
  screenMs: number;
  seatedMs: number;
  standUps: number;
}

export interface TimelineCountBucket {
  startAt: number;
  endAt: number;
  label: string;
  blinkCount: number;
  yawnCount: number;
  standUpCount: number;
  sitDownCount: number;
  hasCoverage: boolean;
}

export interface DurationDisplay {
  value: string;
  unit: "秒" | "分钟" | "小时";
}

function getSessionEnd(
  range: TimelineRange,
  sessionId: string,
  now: number,
): number | null {
  if (sessionId === range.activeSessionId) {
    return now;
  }
  const session = range.sessions.find((candidate) => candidate.id === sessionId);
  return session?.endedAt ?? session?.lastSeenAt ?? null;
}

function getSpanIntervals(
  range: TimelineRange,
  startType: Extract<TimelineEventType, `${string}.started`>,
  endType: Extract<TimelineEventType, `${string}.ended`>,
  now: number,
): TimelineInterval[] {
  const starts = new Map<string, SpanTimelineEvent>();
  const ends = new Map<string, SpanTimelineEvent>();
  for (const event of range.events) {
    if (!hasSpanId(event)) {
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
    const endAt = ends.get(spanId)?.at ?? getSessionEnd(range, start.sessionId, now);
    if (endAt !== null && endAt > start.at) {
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

export function getSeatedIntervals(
  range: TimelineRange,
  now: number,
): TimelineInterval[] {
  return getSpanIntervals(range, "seated.started", "seated.ended", now);
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
  return {
    screenMs: sumIntervals(getScreenIntervals(range, now), from, to),
    seatedMs: sumIntervals(getSeatedIntervals(range, now), from, to),
    standUps: range.events.filter(
      (event) =>
        event.type === "seated.ended" &&
        event.reason === "stand_up" &&
        event.at >= from &&
        event.at < to,
    ).length,
  };
}

function getActiveSpanStartedAt(
  range: TimelineRange,
  startType: Extract<TimelineEventType, `${string}.started`>,
  endType: Extract<TimelineEventType, `${string}.ended`>,
): number | null {
  if (!range.activeSessionId) {
    return null;
  }
  const endedSpans = new Set(
    range.events
      .filter(
        (event): event is SpanTimelineEvent =>
          hasSpanId(event) && event.type === endType,
      )
      .map((event) => event.spanId),
  );
  const active = range.events
    .filter(
      (event) =>
        hasSpanId(event) &&
        event.type === startType &&
        event.sessionId === range.activeSessionId &&
        !endedSpans.has(event.spanId),
    )
    .sort((left, right) => right.at - left.at)[0];
  return active?.at ?? null;
}

export function getActiveScreenStartedAt(range: TimelineRange): number | null {
  return getActiveSpanStartedAt(range, "screen.started", "screen.ended");
}

export function getActiveSeatedStartedAt(range: TimelineRange): number | null {
  return getActiveSpanStartedAt(range, "seated.started", "seated.ended");
}

export function getBlinkTimestamps(
  range: TimelineRange,
  from = Number.NEGATIVE_INFINITY,
  to = Number.POSITIVE_INFINITY,
): number[] {
  return range.events
    .filter(
      (event) =>
        event.type === "blink.detected" && event.at >= from && event.at < to,
    )
    .map((event) => event.at)
    .sort((left, right) => left - right);
}

function formatMinute(timestamp: number): string {
  const date = new Date(timestamp);
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

export function getTimelineCountBucketMs(
  viewDurationMs: number,
  plotWidthPx: number,
): number {
  const targetPointCount = Math.max(
    1,
    Math.floor(Math.max(1, plotWidthPx) / COUNT_POINT_SPACING_PX),
  );
  const requiredIntervalMs = Math.max(
    MINUTE_MS,
    Math.max(MINUTE_MS, viewDurationMs) / targetPointCount,
  );
  return (
    COUNT_BUCKET_INTERVALS_MS.find(
      (intervalMs) => intervalMs >= requiredIntervalMs,
    ) ?? COUNT_BUCKET_INTERVALS_MS[COUNT_BUCKET_INTERVALS_MS.length - 1]
  );
}

function sessionOverlaps(
  range: TimelineRange,
  sessionId: string,
  startedAt: number,
  endedAt: number,
  now: number,
): boolean {
  const session = range.sessions.find(({ id }) => id === sessionId);
  if (!session) {
    return false;
  }
  const sessionEnd =
    session.id === range.activeSessionId
      ? now
      : (session.endedAt ?? session.lastSeenAt);
  return session.startedAt < endedAt && sessionEnd > startedAt;
}

export function buildTimelineCountBuckets(
  range: TimelineRange,
  from: number,
  to: number,
  now: number,
  bucketMs: number,
): TimelineCountBucket[] {
  if (to <= from) {
    return [];
  }

  const fromDate = new Date(from);
  const dayStart = new Date(
    fromDate.getFullYear(),
    fromDate.getMonth(),
    fromDate.getDate(),
  ).getTime();
  const firstBucket =
    dayStart + Math.floor((from - dayStart) / bucketMs) * bucketMs;
  const lastBucketEnd =
    firstBucket + Math.ceil((to - firstBucket) / bucketMs) * bucketMs;
  const buckets = Array.from(
    { length: Math.max(1, (lastBucketEnd - firstBucket) / bucketMs) },
    (_, index): TimelineCountBucket => {
      const startAt = firstBucket + index * bucketMs;
      const endAt = startAt + bucketMs;
      const visibleStartAt = Math.max(startAt, from);
      const visibleEndAt = Math.min(endAt, to);
      const startDate = new Date(startAt);
      const endDate = new Date(endAt);
      const crossesLocalDate =
        startDate.getFullYear() !== endDate.getFullYear() ||
        startDate.getMonth() !== endDate.getMonth() ||
        startDate.getDate() !== endDate.getDate();
      return {
        startAt,
        endAt,
        label:
          bucketMs === MINUTE_MS
            ? formatMinute(startAt)
            : `${formatMinute(startAt)}–${
                crossesLocalDate ? "次日 " : ""
              }${formatMinute(endAt)}`,
        blinkCount: 0,
        yawnCount: 0,
        standUpCount: 0,
        sitDownCount: 0,
        hasCoverage:
          visibleEndAt > visibleStartAt &&
          range.sessions.some((session) =>
            sessionOverlaps(
              range,
              session.id,
              visibleStartAt,
              visibleEndAt,
              now,
            ),
          ),
      };
    },
  );

  const sitDownEventIds = new Set<string>();
  const previousSeatedEndBySession = new Map<
    string,
    Extract<TimelineEvent, { type: "seated.ended" }>
  >();
  for (const event of [...range.events].sort(
    (left, right) => left.at - right.at || left.id.localeCompare(right.id),
  )) {
    if (event.type === "seated.ended") {
      previousSeatedEndBySession.set(event.sessionId, event);
    } else if (event.type === "seated.started") {
      if (previousSeatedEndBySession.get(event.sessionId)?.reason === "stand_up") {
        sitDownEventIds.add(event.id);
      }
      previousSeatedEndBySession.delete(event.sessionId);
    }
  }

  for (const event of range.events) {
    if (event.at < from || event.at >= to) {
      continue;
    }
    const bucket = buckets[Math.floor((event.at - firstBucket) / bucketMs)];
    if (!bucket) {
      continue;
    }
    if (event.type === "blink.detected") {
      bucket.blinkCount += 1;
    } else if (event.type === "yawn.detected") {
      bucket.yawnCount += 1;
    } else if (
      event.type === "seated.started" &&
      sitDownEventIds.has(event.id)
    ) {
      bucket.sitDownCount += 1;
    } else if (event.type === "seated.ended" && event.reason === "stand_up") {
      bucket.standUpCount += 1;
    }
  }

  return buckets;
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
