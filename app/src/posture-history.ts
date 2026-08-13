import {
  formatLocalDateKey,
  getLocalMinuteIndex,
  shiftLocalDateKey,
} from "./local-history-time";
import type { PostureState } from "./posture-signal";

export const POSTURE_HISTORY_STORAGE_KEY = "look-me:posture-history:v1";
export const POSTURE_HISTORY_RETENTION_DAYS = 30;

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;

export type RecordedPostureState = Extract<PostureState, "seated" | "away">;

export interface PostureMinuteAggregate {
  seatedMs: number;
  awayMs: number;
  standUps: number;
}

export interface PostureHistory {
  version: 1;
  days: Record<string, Record<string, PostureMinuteAggregate>>;
}

export interface PostureDaySummary {
  seatedMs: number;
  awayMs: number;
  standUps: number;
}

const EMPTY_BUCKET: Readonly<PostureMinuteAggregate> = {
  seatedMs: 0,
  awayMs: 0,
  standUps: 0,
};

export function createPostureHistory(): PostureHistory {
  return { version: 1, days: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidDateKey(dateKey: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return false;
  }
  return (
    formatLocalDateKey(
      new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12).getTime(),
    ) === dateKey
  );
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function parsePostureHistory(raw: string | null): PostureHistory {
  if (!raw) {
    return createPostureHistory();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.days)) {
      return createPostureHistory();
    }

    const days: PostureHistory["days"] = {};
    for (const [dateKey, rawDay] of Object.entries(parsed.days)) {
      if (!isValidDateKey(dateKey) || !isRecord(rawDay)) {
        continue;
      }

      const day: Record<string, PostureMinuteAggregate> = {};
      for (const [minuteKey, rawBucket] of Object.entries(rawDay)) {
        const minuteIndex = Number(minuteKey);
        if (
          !Number.isInteger(minuteIndex) ||
          minuteIndex < 0 ||
          minuteIndex >= MINUTES_PER_DAY ||
          !isRecord(rawBucket) ||
          !isNonNegativeFiniteNumber(rawBucket.seatedMs) ||
          !isNonNegativeFiniteNumber(rawBucket.awayMs) ||
          !isNonNegativeFiniteNumber(rawBucket.standUps)
        ) {
          continue;
        }

        const seatedMs = Math.min(MINUTE_MS, Math.round(rawBucket.seatedMs));
        const awayMs = Math.min(
          MINUTE_MS - seatedMs,
          Math.round(rawBucket.awayMs),
        );
        day[String(minuteIndex)] = {
          seatedMs,
          awayMs,
          standUps: Math.floor(rawBucket.standUps),
        };
      }
      if (Object.keys(day).length > 0) {
        days[dateKey] = day;
      }
    }
    return { version: 1, days };
  } catch {
    return createPostureHistory();
  }
}

function updateBucket(
  history: PostureHistory,
  timestamp: number,
  update: (bucket: PostureMinuteAggregate) => PostureMinuteAggregate,
): PostureHistory {
  const dateKey = formatLocalDateKey(timestamp);
  const minuteKey = String(getLocalMinuteIndex(timestamp));
  const currentDay = history.days[dateKey] ?? {};
  const currentBucket = currentDay[minuteKey] ?? EMPTY_BUCKET;
  return {
    version: 1,
    days: {
      ...history.days,
      [dateKey]: {
        ...currentDay,
        [minuteKey]: update(currentBucket),
      },
    },
  };
}

export function recordPostureInterval(
  history: PostureHistory,
  state: RecordedPostureState,
  startedAt: number,
  endedAt: number,
): PostureHistory {
  if (
    !Number.isFinite(startedAt) ||
    !Number.isFinite(endedAt) ||
    endedAt <= startedAt
  ) {
    return history;
  }

  let nextHistory = history;
  let cursor = startedAt;
  while (cursor < endedAt) {
    const minuteEnd = new Date(cursor);
    minuteEnd.setSeconds(60, 0);
    const boundary = Math.min(
      endedAt,
      minuteEnd.getTime() > cursor ? minuteEnd.getTime() : cursor + MINUTE_MS,
    );
    const duration = boundary - cursor;
    nextHistory = updateBucket(nextHistory, cursor, (bucket) => {
      const availableMs = Math.max(
        0,
        MINUTE_MS - bucket.seatedMs - bucket.awayMs,
      );
      const recordedMs = Math.min(availableMs, duration);
      return {
        ...bucket,
        seatedMs:
          state === "seated" ? bucket.seatedMs + recordedMs : bucket.seatedMs,
        awayMs: state === "away" ? bucket.awayMs + recordedMs : bucket.awayMs,
      };
    });
    cursor = boundary;
  }
  return nextHistory;
}

export function recordStandUp(
  history: PostureHistory,
  timestamp: number,
): PostureHistory {
  if (!Number.isFinite(timestamp)) {
    return history;
  }
  return updateBucket(history, timestamp, (bucket) => ({
    ...bucket,
    standUps: bucket.standUps + 1,
  }));
}

export function prunePostureHistory(
  history: PostureHistory,
  todayKey: string,
  retentionDays = POSTURE_HISTORY_RETENTION_DAYS,
): PostureHistory {
  const firstDateKey = shiftLocalDateKey(todayKey, -(retentionDays - 1));
  const days = Object.fromEntries(
    Object.entries(history.days).filter(
      ([dateKey]) => dateKey >= firstDateKey && dateKey <= todayKey,
    ),
  );
  return Object.keys(days).length === Object.keys(history.days).length
    ? history
    : { version: 1, days };
}

export function summarizePostureDay(
  history: PostureHistory,
  dateKey: string,
): PostureDaySummary {
  return Object.values(history.days[dateKey] ?? {}).reduce<PostureDaySummary>(
    (summary, bucket) => ({
      seatedMs: summary.seatedMs + bucket.seatedMs,
      awayMs: summary.awayMs + bucket.awayMs,
      standUps: summary.standUps + bucket.standUps,
    }),
    { seatedMs: 0, awayMs: 0, standUps: 0 },
  );
}
