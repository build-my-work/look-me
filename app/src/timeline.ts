export const TIMELINE_RETENTION_DAYS = 30;
export const MAX_CONTIGUOUS_OBSERVATION_GAP_MS = 1_500;

export const TIMELINE_EVENT_TYPES = [
  "blink.detected",
  "seated.started",
  "seated.ended",
  "screen.started",
  "screen.ended",
  "yawn.detected",
] as const;

export type TimelineEventType = (typeof TIMELINE_EVENT_TYPES)[number];
export type SeatedEndReason = "stand_up" | "tracking_lost";

interface TimelineEventBase {
  id: string;
  sessionId: string;
  at: number;
}

export type TimelineEvent =
  | (TimelineEventBase & {
      type: "blink.detected" | "yawn.detected";
    })
  | (TimelineEventBase & {
      type: "screen.started" | "screen.ended" | "seated.started";
      spanId: string;
    })
  | (TimelineEventBase & {
      type: "seated.ended";
      spanId: string;
      reason: SeatedEndReason;
    });

export type TimelineEventInput = TimelineEvent extends infer Event
  ? Event extends TimelineEvent
    ? Omit<Event, "id" | "sessionId">
    : never
  : never;

export interface TimelineSession {
  id: string;
  startedAt: number;
  lastSeenAt: number;
  endedAt?: number;
}

export interface TimelineRange {
  events: TimelineEvent[];
  sessions: TimelineSession[];
  activeSessionId: string | null;
}

export const TIMELINE_PREDECESSOR_TYPES = [
  "screen.started",
  "screen.ended",
  "seated.started",
  "seated.ended",
] as const satisfies readonly TimelineEventType[];

export function sortTimelineEvents(events: readonly TimelineEvent[]): TimelineEvent[] {
  return [...events].sort(
    (left, right) => left.at - right.at || left.id.localeCompare(right.id),
  );
}

export function mergeTimelineEvents(
  ...collections: ReadonlyArray<readonly TimelineEvent[]>
): TimelineEvent[] {
  const byId = new Map<string, TimelineEvent>();
  for (const events of collections) {
    for (const event of events) {
      byId.set(event.id, event);
    }
  }
  return sortTimelineEvents([...byId.values()]);
}

export function mergeTimelineSessions(
  ...collections: ReadonlyArray<readonly TimelineSession[]>
): TimelineSession[] {
  const byId = new Map<string, TimelineSession>();
  for (const sessions of collections) {
    for (const session of sessions) {
      byId.set(session.id, session);
    }
  }
  return [...byId.values()].sort(
    (left, right) => left.startedAt - right.startedAt || left.id.localeCompare(right.id),
  );
}

export function getLocalDayRange(dateKey: string): { startAt: number; endAt: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const startAt = new Date(year, month - 1, day).getTime();
  const endAt = new Date(year, month - 1, day + 1).getTime();
  return { startAt, endAt };
}
