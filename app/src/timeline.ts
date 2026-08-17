export const TIMELINE_RETENTION_DAYS = 30;
export const MAX_CONTIGUOUS_OBSERVATION_GAP_MS = 1_500;

export type TimelineLayer = "fact" | "decision" | "action";

export type TimelineEventType =
  | "monitoring.started"
  | "monitoring.stopped"
  | "distance-reminder.enabled"
  | "distance-reminder.disabled"
  | "screen.started"
  | "screen.ended"
  | "blink.detected"
  | "mouth.opened"
  | "mouth.closed"
  | "posture.changed"
  | "stand-up.detected"
  | "yawn.detected"
  | "distance.due"
  | "blink-reminder.due"
  | "sedentary.due"
  | "yawn-response.shown"
  | "distance-reminder.shown"
  | "distance-reminder.completed"
  | "distance-reminder.skipped"
  | "distance-reminder.dismissed"
  | "blink-reminder.shown"
  | "blink-reminder.completed"
  | "blink-reminder.dismissed"
  | "sedentary-reminder.shown"
  | "sedentary-reminder.acknowledged"
  | "sedentary-reminder.dismissed";

export type TimelineEventValue = string | number | boolean | null;

export interface TimelineEvent {
  id: string;
  sessionId: string;
  at: number;
  layer: TimelineLayer;
  type: TimelineEventType;
  spanId?: string;
  causedBy?: string[];
  data?: Record<string, TimelineEventValue>;
}

export type TimelineEventInput = Omit<TimelineEvent, "id" | "sessionId">;

export interface TimelineSession {
  id: string;
  startedAt: number;
  lastSeenAt: number;
  endedAt?: number;
}

export interface TimelineRange {
  events: TimelineEvent[];
  sessions: TimelineSession[];
  currentSessionId: string;
}

export const TIMELINE_PREDECESSOR_TYPES: readonly TimelineEventType[] = [
  "screen.started",
  "screen.ended",
  "mouth.opened",
  "mouth.closed",
  "posture.changed",
];

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

export function getLocalDayRange(dateKey: string): { startAt: number; endAt: number } {
  const [year, month, day] = dateKey.split("-").map(Number);
  const startAt = new Date(year, month - 1, day).getTime();
  const endAt = new Date(year, month - 1, day + 1).getTime();
  return { startAt, endAt };
}
