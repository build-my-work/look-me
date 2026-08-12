export const MIN_STATS_OBSERVATION_MS = 15_000;
export const ROLLING_RATE_WINDOW_MS = 60_000;

export interface BlinkStatistics {
  rollingRate: number | null;
  segmentAverage: number | null;
  recentCount: number;
  totalCount: number;
  collectingSecondsRemaining: number;
}

export function calculateBlinkStatistics(
  blinkTimestamps: readonly number[],
  sessionStartedAt: number | null,
  visibleSince: number | null,
  now: number,
): BlinkStatistics {
  const totalCount =
    sessionStartedAt === null
      ? 0
      : blinkTimestamps.filter(
          (timestamp) => timestamp >= sessionStartedAt && timestamp <= now,
        ).length;

  if (visibleSince === null || now <= visibleSince) {
    return {
      rollingRate: null,
      segmentAverage: null,
      recentCount: 0,
      totalCount,
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
  const segmentCount = blinkTimestamps.filter(
    (timestamp) => timestamp >= visibleSince && timestamp <= now,
  ).length;
  const collectingSecondsRemaining = Math.max(
    0,
    Math.ceil((MIN_STATS_OBSERVATION_MS - segmentDuration) / 1_000),
  );

  if (segmentDuration < MIN_STATS_OBSERVATION_MS) {
    return {
      rollingRate: null,
      segmentAverage: null,
      recentCount,
      totalCount,
      collectingSecondsRemaining,
    };
  }

  return {
    rollingRate: Math.round(
      (recentCount * ROLLING_RATE_WINDOW_MS) / windowDuration,
    ),
    segmentAverage: Math.round(
      (segmentCount * ROLLING_RATE_WINDOW_MS) / segmentDuration,
    ),
    recentCount,
    totalCount,
    collectingSecondsRemaining: 0,
  };
}
