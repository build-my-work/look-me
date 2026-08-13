export const BLINK_HISTORY_STORAGE_KEY = "look-me:blink-history:v1";
export const BLINK_HISTORY_RETENTION_DAYS = 30;
export const MIN_MINUTE_OBSERVATION_MS = 15_000;

const MINUTE_MS = 60_000;
const MINUTES_PER_DAY = 24 * 60;

export interface MinuteAggregate {
  blinks: number;
  observedMs: number;
}

export interface BlinkHistory {
  version: 1;
  days: Record<string, Record<string, MinuteAggregate>>;
}

export interface BlinkHistoryPoint {
  minuteIndex: number;
  label: string;
  blinkCount: number | null;
  screenSeconds: number | null;
  observedMs: number;
}

export interface BlinkHistorySummary {
  totalBlinks: number;
  observedMs: number;
  validMinuteCount: number;
  averageRate: number | null;
}

export interface ObservedDurationDisplay {
  value: string;
  unit: "秒" | "分钟" | "小时";
}

export function createBlinkHistory(): BlinkHistory {
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

  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
  );
  return formatLocalDateKey(date.getTime()) === dateKey;
}

export function parseBlinkHistory(raw: string | null): BlinkHistory {
  if (!raw) {
    return createBlinkHistory();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.days)) {
      return createBlinkHistory();
    }

    const days: BlinkHistory["days"] = {};
    for (const [dateKey, rawDay] of Object.entries(parsed.days)) {
      if (!isValidDateKey(dateKey) || !isRecord(rawDay)) {
        continue;
      }

      const day: Record<string, MinuteAggregate> = {};
      for (const [minuteKey, rawBucket] of Object.entries(rawDay)) {
        const minuteIndex = Number(minuteKey);
        if (
          !Number.isInteger(minuteIndex) ||
          minuteIndex < 0 ||
          minuteIndex >= MINUTES_PER_DAY ||
          !isRecord(rawBucket) ||
          typeof rawBucket.blinks !== "number" ||
          typeof rawBucket.observedMs !== "number" ||
          !Number.isFinite(rawBucket.blinks) ||
          !Number.isFinite(rawBucket.observedMs) ||
          rawBucket.blinks < 0 ||
          rawBucket.observedMs < 0
        ) {
          continue;
        }

        day[String(minuteIndex)] = {
          blinks: Math.floor(rawBucket.blinks),
          observedMs: Math.min(MINUTE_MS, Math.round(rawBucket.observedMs)),
        };
      }

      if (Object.keys(day).length > 0) {
        days[dateKey] = day;
      }
    }

    return { version: 1, days };
  } catch {
    return createBlinkHistory();
  }
}

export function formatLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getLocalMinuteIndex(timestamp: number): number {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

export function formatMinuteLabel(minuteIndex: number): string {
  const hours = Math.floor(minuteIndex / 60);
  const minutes = minuteIndex % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatObservedDuration(
  observedMs: number,
): ObservedDurationDisplay {
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

export function shiftLocalDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (!year || !month || !day) {
    return dateKey;
  }
  return formatLocalDateKey(new Date(year, month - 1, day + days, 12).getTime());
}

export function recordBlink(history: BlinkHistory, timestamp: number): BlinkHistory {
  if (!Number.isFinite(timestamp)) {
    return history;
  }

  const dateKey = formatLocalDateKey(timestamp);
  const minuteKey = String(getLocalMinuteIndex(timestamp));
  const currentDay = history.days[dateKey] ?? {};
  const currentBucket = currentDay[minuteKey] ?? { blinks: 0, observedMs: 0 };

  return {
    version: 1,
    days: {
      ...history.days,
      [dateKey]: {
        ...currentDay,
        [minuteKey]: {
          blinks: currentBucket.blinks + 1,
          observedMs: currentBucket.observedMs,
        },
      },
    },
  };
}

export function recordObservedInterval(
  history: BlinkHistory,
  startedAt: number,
  endedAt: number,
): BlinkHistory {
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
    const dateKey = formatLocalDateKey(cursor);
    const minuteKey = String(getLocalMinuteIndex(cursor));
    const currentDay = nextHistory.days[dateKey] ?? {};
    const currentBucket = currentDay[minuteKey] ?? { blinks: 0, observedMs: 0 };

    nextHistory = {
      version: 1,
      days: {
        ...nextHistory.days,
        [dateKey]: {
          ...currentDay,
          [minuteKey]: {
            blinks: currentBucket.blinks,
            observedMs: Math.min(
              MINUTE_MS,
              currentBucket.observedMs + boundary - cursor,
            ),
          },
        },
      },
    };
    cursor = boundary;
  }

  return nextHistory;
}

export function pruneBlinkHistory(
  history: BlinkHistory,
  todayKey: string,
  retentionDays = BLINK_HISTORY_RETENTION_DAYS,
): BlinkHistory {
  const firstDateKey = shiftLocalDateKey(todayKey, -(retentionDays - 1));
  const retainedDays = Object.fromEntries(
    Object.entries(history.days).filter(
      ([dateKey]) => dateKey >= firstDateKey && dateKey <= todayKey,
    ),
  );

  if (Object.keys(retainedDays).length === Object.keys(history.days).length) {
    return history;
  }
  return { version: 1, days: retainedDays };
}

export function getDaySeries(
  history: BlinkHistory,
  dateKey: string,
): BlinkHistoryPoint[] {
  const day = history.days[dateKey] ?? {};
  return Array.from({ length: MINUTES_PER_DAY }, (_, minuteIndex) => {
    const bucket = day[String(minuteIndex)] ?? { blinks: 0, observedMs: 0 };
    return {
      minuteIndex,
      label: formatMinuteLabel(minuteIndex),
      blinkCount:
        bucket.observedMs > 0 || bucket.blinks > 0 ? bucket.blinks : null,
      screenSeconds:
        bucket.observedMs > 0
          ? Math.round(bucket.observedMs / 1_000)
          : null,
      observedMs: bucket.observedMs,
    };
  });
}

export function summarizeDay(
  history: BlinkHistory,
  dateKey: string,
): BlinkHistorySummary {
  const buckets = Object.values(history.days[dateKey] ?? {});
  let totalBlinks = 0;
  let totalObservedMs = 0;
  let validBlinks = 0;
  let validObservedMs = 0;
  let validMinuteCount = 0;

  for (const bucket of buckets) {
    totalBlinks += bucket.blinks;
    totalObservedMs += bucket.observedMs;
    if (bucket.observedMs >= MIN_MINUTE_OBSERVATION_MS) {
      validBlinks += bucket.blinks;
      validObservedMs += bucket.observedMs;
      validMinuteCount += 1;
    }
  }

  return {
    totalBlinks,
    observedMs: totalObservedMs,
    validMinuteCount,
    averageRate:
      validObservedMs > 0
        ? Math.round((validBlinks * MINUTE_MS) / validObservedMs)
        : null,
  };
}
