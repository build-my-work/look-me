import { getLocalDayRange, type TimelineEvent, type TimelineRange } from "./timeline";

const MINUTE_MS = 60_000;

export function createTimelineDemoRange(dateKey: string): TimelineRange {
  const { startAt } = getLocalDayRange(dateKey);
  const sessionId = `demo:${dateKey}`;
  const events: TimelineEvent[] = [];
  let sequence = 0;
  const add = (
    event: Omit<TimelineEvent, "id" | "sessionId">,
  ): TimelineEvent => {
    const recorded = {
      ...event,
      id: `${sessionId}:${sequence++}`,
      sessionId,
    };
    events.push(recorded);
    return recorded;
  };
  const atMinute = (minute: number, offsetMs = 0) =>
    startAt + minute * MINUTE_MS + offsetMs;
  const screenRanges = [
    [8 * 60 + 30, 10 * 60 + 30],
    [10 * 60 + 38, 12 * 60],
    [13 * 60 + 20, 15 * 60 + 20],
    [15 * 60 + 28, 17 * 60],
    [17 * 60 + 6, 18 * 60 + 20],
  ] as const;

  add({ at: atMinute(8 * 60 + 29), layer: "fact", type: "monitoring.started" });
  add({
    at: atMinute(8 * 60 + 29),
    layer: "fact",
    type: "distance-reminder.enabled",
  });
  for (const [rangeIndex, [startedAt, endedAt]] of screenRanges.entries()) {
    const spanId = `demo-screen-${rangeIndex}`;
    add({
      at: atMinute(startedAt),
      layer: "fact",
      type: "screen.started",
      spanId,
    });
    add({
      at: atMinute(endedAt),
      layer: "fact",
      type: "screen.ended",
      spanId,
      data: { reason: "demo-break" },
    });

    for (let minute = startedAt; minute < endedAt; minute += 1) {
      const blinkCount = Math.max(
        5,
        Math.round(13 + Math.sin(minute / 24) * 3 + Math.cos(minute / 11) * 2),
      );
      for (let blink = 0; blink < blinkCount; blink += 1) {
        add({
          at: atMinute(minute, ((blink + 1) * MINUTE_MS) / (blinkCount + 1)),
          layer: "fact",
          type: "blink.detected",
        });
      }
      if (minute % 13 === 0) {
        const mouthSpanId = `demo-mouth-${minute}`;
        const durationMs = minute % 26 === 0 ? 1_800 : 650;
        add({
          at: atMinute(minute, 20_000),
          layer: "fact",
          type: "mouth.opened",
          spanId: mouthSpanId,
          data: { jawOpen: 0.72 },
        });
        if (durationMs >= 1_200) {
          const decision = add({
            at: atMinute(minute, 21_200),
            layer: "decision",
            type: "yawn.detected",
            data: { openDurationMs: 1_200, thresholdMs: 1_200 },
          });
          add({
            at: atMinute(minute, 21_250),
            layer: "action",
            type: "yawn-response.shown",
            causedBy: [decision.id],
          });
        }
        add({
          at: atMinute(minute, 20_000 + durationMs),
          layer: "fact",
          type: "mouth.closed",
          spanId: mouthSpanId,
          data: { jawOpen: 0.2, reason: "detected" },
        });
      }
    }
  }

  const awayRanges = [
    [10 * 60 + 30, 10 * 60 + 38],
    [12 * 60, 13 * 60 + 20],
    [15 * 60 + 20, 15 * 60 + 28],
    [17 * 60, 17 * 60 + 6],
  ] as const;
  add({
    at: atMinute(8 * 60 + 30),
    layer: "fact",
    type: "posture.changed",
    data: { state: "seated" },
  });
  for (const [startedAt, endedAt] of awayRanges) {
    add({
      at: atMinute(startedAt),
      layer: "fact",
      type: "posture.changed",
      data: { state: "away" },
    });
    add({
      at: atMinute(startedAt),
      layer: "fact",
      type: "stand-up.detected",
    });
    add({
      at: atMinute(endedAt),
      layer: "fact",
      type: "posture.changed",
      data: { state: "seated" },
    });
  }

  events.sort((left, right) => left.at - right.at || left.id.localeCompare(right.id));
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
    currentSessionId: "live-session",
  };
}
