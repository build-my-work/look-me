export const MIN_STATS_OBSERVATION_MS = 15_000;
export const ROLLING_RATE_WINDOW_MS = 60_000;

export interface BlinkStatistics {
  rollingRate: number | null;
  collectingSecondsRemaining: number;
}

export function calculateBlinkStatistics(
  blinkTimestamps: readonly number[],
  visibleSince: number | null,
  now: number,
): BlinkStatistics {
  if (visibleSince === null || now <= visibleSince) {
    return {
      rollingRate: null,
      collectingSecondsRemaining: Math.ceil(MIN_STATS_OBSERVATION_MS / 1_000),
    };
  }

  const segmentDuration = now - visibleSince;
  const windowStartedAt = Math.max(
    visibleSince,
    now - ROLLING_RATE_WINDOW_MS,
  );
  const windowDuration = now - windowStartedAt;
  const recentCount = blinkTimestamps.filter(
    (timestamp) => timestamp >= windowStartedAt && timestamp <= now,
  ).length;
  const collectingSecondsRemaining = Math.max(
    0,
    Math.ceil((MIN_STATS_OBSERVATION_MS - segmentDuration) / 1_000),
  );

  if (segmentDuration < MIN_STATS_OBSERVATION_MS) {
    return {
      rollingRate: null,
      collectingSecondsRemaining,
    };
  }

  return {
    rollingRate: Math.round(
      (recentCount * ROLLING_RATE_WINDOW_MS) / windowDuration,
    ),
    collectingSecondsRemaining: 0,
  };
}
