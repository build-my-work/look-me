import {
  getLocalDayRange,
  type TimelineEvent,
  type TimelineEventInput,
  type TimelineRange,
} from "./timeline";

const MINUTE_MS = 60_000;

export function createTimelineDemoRange(dateKey: string): TimelineRange {
  const { startAt } = getLocalDayRange(dateKey);
  const sessionId = `demo:${dateKey}`;
  const events: TimelineEvent[] = [];
  let sequence = 0;
  const add = (input: TimelineEventInput): void => {
    events.push({
      ...input,
      id: `${sessionId}:${sequence++}`,
      sessionId,
    } as TimelineEvent);
  };
  const atMinute = (minute: number, offsetMs = 0) =>
    startAt + minute * MINUTE_MS + offsetMs;
  const seatedRanges = [
    [8 * 60 + 30, 10 * 60 + 30],
    [10 * 60 + 38, 12 * 60],
    [13 * 60 + 20, 15 * 60 + 20],
    [15 * 60 + 28, 17 * 60],
    [17 * 60 + 6, 18 * 60 + 20],
  ] as const;

  for (const [rangeIndex, [startedAt, endedAt]] of seatedRanges.entries()) {
    const screenSpanId = `demo-screen-${rangeIndex}`;
    const seatedSpanId = `demo-seated-${rangeIndex}`;
    add({
      at: atMinute(startedAt),
      type: "screen.started",
      spanId: screenSpanId,
    });
    add({
      at: atMinute(startedAt),
      type: "seated.started",
      spanId: seatedSpanId,
    });

    for (let minute = startedAt; minute < endedAt; minute += 1) {
      const blinkCount = Math.max(
        5,
        Math.round(13 + Math.sin(minute / 24) * 3 + Math.cos(minute / 11) * 2),
      );
      for (let blink = 0; blink < blinkCount; blink += 1) {
        add({
          at: atMinute(minute, ((blink + 1) * MINUTE_MS) / (blinkCount + 1)),
          type: "blink.detected",
        });
      }
      if (minute % 26 === 0) {
        add({ at: atMinute(minute, 21_200), type: "yawn.detected" });
      }
    }

    add({
      at: atMinute(endedAt),
      type: "screen.ended",
      spanId: screenSpanId,
    });
    add({
      at: atMinute(endedAt),
      type: "seated.ended",
      spanId: seatedSpanId,
      reason:
        rangeIndex === seatedRanges.length - 1 ? "tracking_lost" : "stand_up",
    });
  }

  events.sort(
    (left, right) => left.at - right.at || left.id.localeCompare(right.id),
  );
  return {
    events,
    sessions: [
      {
        id: sessionId,
        startedAt: atMinute(8 * 60 + 29),
        lastSeenAt: atMinute(18 * 60 + 20),
        endedAt: atMinute(18 * 60 + 20),
      },
    ],
    activeSessionId: null,
  };
}
