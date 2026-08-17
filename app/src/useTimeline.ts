import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PostureState } from "./posture-signal";
import {
  MAX_CONTIGUOUS_OBSERVATION_GAP_MS,
  type TimelineEvent,
  type TimelineEventType,
  type TimelineRange,
  mergeTimelineEvents,
} from "./timeline";
import {
  type TimelineRepository,
  timelineRepository,
} from "./timeline-store";
import type {
  BlinkDetectionEvent,
  MouthTransitionEvent,
  YawnDetectionEvent,
} from "./useFaceMonitor";

interface OpenSpan {
  spanId: string;
  startEventId: string;
  lastObservedAt: number;
}

export interface TimelineCaptureInput {
  now: number;
  monitoring: boolean;
  sensingReady: boolean;
  distanceReminderEnabled: boolean;
  screenObserving: boolean;
  screenEndReason: string;
  blinkEvents: readonly BlinkDetectionEvent[];
  mouthEvents: readonly MouthTransitionEvent[];
  yawnEvents: readonly YawnDetectionEvent[];
  postureState: PostureState;
  postureStateSince: number | null;
  standUpTimestamps: readonly number[];
}

function createSpanId(prefix: string): string {
  const randomPart = globalThis.crypto?.randomUUID?.() ??
    Math.random().toString(36).slice(2);
  return `${prefix}:${randomPart}`;
}

function getOpenCurrentSpan(
  repository: TimelineRepository,
  startType: TimelineEventType,
  endType: TimelineEventType,
): OpenSpan | null {
  const events = repository.getCurrentEvents();
  const endedSpans = new Set(
    events
      .filter((event) => event.type === endType && event.spanId)
      .map((event) => event.spanId),
  );
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.type === startType && event.spanId && !endedSpans.has(event.spanId)) {
      return {
        spanId: event.spanId,
        startEventId: event.id,
        lastObservedAt: event.at,
      };
    }
  }
  return null;
}

function latestLifecycleType(
  repository: TimelineRepository,
  startedType: TimelineEventType,
  stoppedType: TimelineEventType,
): TimelineEventType | null {
  const started = repository.findLatestCurrentEvent(startedType);
  const stopped = repository.findLatestCurrentEvent(stoppedType);
  if (!started && !stopped) {
    return null;
  }
  return !stopped || (started && started.at >= stopped.at) ? startedType : stoppedType;
}

export function useTimelineCapture(
  input: TimelineCaptureInput,
  repository = timelineRepository,
): void {
  const screenSpan = useRef<OpenSpan | null>(
    getOpenCurrentSpan(repository, "screen.started", "screen.ended"),
  );
  const mouthSpan = useRef<OpenSpan | null>(
    getOpenCurrentSpan(repository, "mouth.opened", "mouth.closed"),
  );
  const processedBlinkCount = useRef(0);
  const processedMouthCount = useRef(0);
  const processedYawnCount = useRef(0);
  const processedStandUpCount = useRef(0);
  const lastPostureState = useRef<PostureState | null>(null);

  useEffect(() => {
    const expectedType = input.monitoring
      ? "monitoring.started"
      : "monitoring.stopped";
    if (
      latestLifecycleType(
        repository,
        "monitoring.started",
        "monitoring.stopped",
      ) !== expectedType
    ) {
      repository.record({
        at: input.now,
        layer: "fact",
        type: expectedType,
      });
    }
  }, [input.monitoring, input.now, repository]);

  useEffect(() => {
    const expectedType = input.distanceReminderEnabled
      ? "distance-reminder.enabled"
      : "distance-reminder.disabled";
    if (
      latestLifecycleType(
        repository,
        "distance-reminder.enabled",
        "distance-reminder.disabled",
      ) !== expectedType
    ) {
      repository.record({
        at: input.now,
        layer: "fact",
        type: expectedType,
      });
    }
  }, [input.distanceReminderEnabled, input.now, repository]);

  useEffect(() => {
    const observing = input.screenObserving;
    const current = screenSpan.current;
    if (!observing) {
      if (current) {
        repository.record({
          at: current.lastObservedAt,
          layer: "fact",
          type: "screen.ended",
          spanId: current.spanId,
          causedBy: [current.startEventId],
          data: { reason: input.screenEndReason },
        });
        screenSpan.current = null;
      }
      return;
    }

    if (
      current &&
      input.now - current.lastObservedAt > MAX_CONTIGUOUS_OBSERVATION_GAP_MS
    ) {
      repository.record({
        at: current.lastObservedAt,
        layer: "fact",
        type: "screen.ended",
        spanId: current.spanId,
        causedBy: [current.startEventId],
        data: { reason: "observation-gap" },
      });
      screenSpan.current = null;
    }

    if (!screenSpan.current) {
      const spanId = createSpanId("screen");
      const started = repository.record({
        at: input.now,
        layer: "fact",
        type: "screen.started",
        spanId,
      });
      screenSpan.current = {
        spanId,
        startEventId: started.id,
        lastObservedAt: input.now,
      };
      return;
    }
    screenSpan.current.lastObservedAt = input.now;
  }, [
    input.now,
    input.screenEndReason,
    input.screenObserving,
    repository,
  ]);

  useEffect(() => {
    if (input.blinkEvents.length < processedBlinkCount.current) {
      processedBlinkCount.current = 0;
    }
    const unprocessed = input.blinkEvents.slice(processedBlinkCount.current);
    processedBlinkCount.current = input.blinkEvents.length;
    repository.recordMany(
      unprocessed.map((event) => ({
        at: event.at,
        layer: "fact" as const,
        type: "blink.detected" as const,
        data: {
          closedAt: event.closedAt,
          openedAt: event.openedAt,
          closedDurationMs: event.closedDurationMs,
          peakLeftBlend: event.peakLeftBlend,
          peakRightBlend: event.peakRightBlend,
          minimumEar: event.minimumEar,
        },
      })),
    );
  }, [input.blinkEvents, repository]);

  useEffect(() => {
    if (input.mouthEvents.length < processedMouthCount.current) {
      processedMouthCount.current = 0;
    }
    const unprocessed = input.mouthEvents.slice(processedMouthCount.current);
    processedMouthCount.current = input.mouthEvents.length;
    for (const event of unprocessed) {
      if (event.state === "opened" && !mouthSpan.current) {
        const spanId = createSpanId("mouth");
        const started = repository.record({
          at: event.at,
          layer: "fact",
          type: "mouth.opened",
          spanId,
          data: { jawOpen: event.jawOpen },
        });
        mouthSpan.current = {
          spanId,
          startEventId: started.id,
          lastObservedAt: event.at,
        };
      } else if (event.state === "closed" && mouthSpan.current) {
        const current = mouthSpan.current;
        repository.record({
          at: event.at,
          layer: "fact",
          type: "mouth.closed",
          spanId: current.spanId,
          causedBy: [current.startEventId],
          data: { jawOpen: event.jawOpen, reason: event.reason },
        });
        mouthSpan.current = null;
      }
    }
  }, [input.mouthEvents, repository]);

  useEffect(() => {
    if ((!input.monitoring || !input.sensingReady) && mouthSpan.current) {
      const current = mouthSpan.current;
      repository.record({
        at: input.now,
        layer: "fact",
        type: "mouth.closed",
        spanId: current.spanId,
        causedBy: [current.startEventId],
        data: {
          jawOpen: 0,
          reason: input.monitoring ? "sensing-unavailable" : "monitoring-stopped",
        },
      });
      mouthSpan.current = null;
    }
  }, [input.monitoring, input.now, input.sensingReady, repository]);

  useEffect(() => {
    if (input.yawnEvents.length < processedYawnCount.current) {
      processedYawnCount.current = 0;
    }
    const unprocessed = input.yawnEvents.slice(processedYawnCount.current);
    processedYawnCount.current = input.yawnEvents.length;
    repository.recordMany(
      unprocessed.map((event) => ({
        at: event.at,
        layer: "decision" as const,
        type: "yawn.detected" as const,
        ...(mouthSpan.current
          ? { causedBy: [mouthSpan.current.startEventId] }
          : {}),
        data: {
          openedAt: event.openedAt,
          openDurationMs: event.openDurationMs,
          thresholdMs: event.thresholdMs,
        },
      })),
    );
  }, [input.yawnEvents, repository]);

  useEffect(() => {
    const lastRecorded = repository.findLatestCurrentEvent("posture.changed");
    const lastRecordedState = lastRecorded?.data?.state;
    if (
      lastPostureState.current === input.postureState ||
      lastRecordedState === input.postureState
    ) {
      lastPostureState.current = input.postureState;
      return;
    }
    repository.record({
      at: input.postureStateSince ?? input.now,
      layer: "fact",
      type: "posture.changed",
      data: { state: input.postureState },
    });
    lastPostureState.current = input.postureState;
  }, [input.now, input.postureState, input.postureStateSince, repository]);

  useEffect(() => {
    if (input.standUpTimestamps.length < processedStandUpCount.current) {
      processedStandUpCount.current = 0;
    }
    const unprocessed = input.standUpTimestamps.slice(processedStandUpCount.current);
    processedStandUpCount.current = input.standUpTimestamps.length;
    repository.recordMany(
      unprocessed.map((at) => ({
        at,
        layer: "fact" as const,
        type: "stand-up.detected" as const,
      })),
    );
  }, [input.standUpTimestamps, repository]);
}

export function useCurrentTimelineRange(
  repository = timelineRepository,
): TimelineRange {
  const events = useSyncExternalStore(
    repository.subscribe,
    repository.getCurrentEvents,
    repository.getCurrentEvents,
  );
  return useMemo(
    () => ({
      events: [...events],
      sessions: [
        {
          id: repository.currentSessionId,
          startedAt: events[0]?.at ?? Date.now(),
          lastSeenAt: Date.now(),
        },
      ],
      currentSessionId: repository.currentSessionId,
    }),
    [events, repository],
  );
}

export function useTimelineRange(
  from: number,
  to: number,
  repository = timelineRepository,
): TimelineRange {
  const currentEvents = useSyncExternalStore(
    repository.subscribe,
    repository.getCurrentEvents,
    repository.getCurrentEvents,
  );
  const [loadedRange, setLoadedRange] = useState<{
    repository: TimelineRepository;
    from: number;
    to: number;
    value: TimelineRange;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void repository.queryRange(from, to).then((loaded) => {
      if (active) {
        setLoadedRange({ repository, from, to, value: loaded });
      }
    });
    return () => {
      active = false;
    };
  }, [from, repository, to]);

  return useMemo(() => {
    const persisted =
      loadedRange?.repository === repository &&
      loadedRange.from === from &&
      loadedRange.to === to
        ? loadedRange.value
        : {
            events: [],
            sessions: [],
            currentSessionId: repository.currentSessionId,
          };
    return {
      events: mergeTimelineEvents(persisted.events, currentEvents),
      sessions: persisted.sessions,
      currentSessionId: repository.currentSessionId,
    };
  }, [currentEvents, from, loadedRange, repository, to]);
}
