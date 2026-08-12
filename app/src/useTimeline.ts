import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { PostureState } from "./posture-signal";
import {
  MAX_CONTIGUOUS_OBSERVATION_GAP_MS,
  type SeatedEndReason,
  type TimelineEvent,
  type TimelineEventType,
  type TimelineRange,
  mergeTimelineEvents,
  mergeTimelineSessions,
} from "./timeline";
import {
  type TimelineRepository,
  timelineRepository,
} from "./timeline-store";
import type {
  BlinkDetectionEvent,
  YawnDetectionEvent,
} from "./useFaceMonitor";

interface OpenSpan {
  spanId: string;
  startedAt: number;
  lastObservedAt: number;
}

type SpanTimelineEvent = Extract<TimelineEvent, { spanId: string }>;

function hasSpanId(event: TimelineEvent): event is SpanTimelineEvent {
  return "spanId" in event;
}

export interface TimelineCaptureInput {
  now: number;
  observedAt: number | null;
  collecting: boolean;
  screenObserving: boolean;
  blinkEvents: readonly BlinkDetectionEvent[];
  yawnEvents: readonly YawnDetectionEvent[];
  postureState: PostureState;
  postureStateSince: number | null;
}

function createSpanId(prefix: "screen" | "seated"): string {
  const randomPart =
    globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}:${randomPart}`;
}

function getOpenSpan(
  repository: TimelineRepository,
  startType: Extract<TimelineEventType, `${string}.started`>,
  endType: Extract<TimelineEventType, `${string}.ended`>,
): OpenSpan | null {
  const snapshot = repository.getSnapshot();
  if (!snapshot.activeSessionId) {
    return null;
  }
  const endedSpanIds = new Set(
    snapshot.events
      .filter(
        (event): event is SpanTimelineEvent =>
          hasSpanId(event) && event.type === endType,
      )
      .map((event) => event.spanId),
  );
  let started: SpanTimelineEvent | undefined;
  for (const event of [...snapshot.events].reverse()) {
    if (
      hasSpanId(event) &&
      event.type === startType &&
      event.sessionId === snapshot.activeSessionId &&
      !endedSpanIds.has(event.spanId)
    ) {
      started = event;
      break;
    }
  }
  if (!started) {
    return null;
  }
  return {
    spanId: started.spanId,
    startedAt: started.at,
    lastObservedAt: started.at,
  };
}

function closeScreenSpan(
  repository: TimelineRepository,
  span: OpenSpan,
  at: number,
): void {
  repository.record({
    at: Math.max(span.startedAt, at),
    type: "screen.ended",
    spanId: span.spanId,
  });
}

function closeSeatedSpan(
  repository: TimelineRepository,
  span: OpenSpan,
  at: number,
  reason: SeatedEndReason,
): void {
  repository.record({
    at: Math.max(span.startedAt, at),
    type: "seated.ended",
    spanId: span.spanId,
    reason,
  });
}

export function useTimelineCapture(
  input: TimelineCaptureInput,
  repository = timelineRepository,
): void {
  const screenSpan = useRef<OpenSpan | null>(null);
  const seatedSpan = useRef<OpenSpan | null>(null);
  const spansInitialized = useRef(false);
  if (!spansInitialized.current) {
    screenSpan.current = getOpenSpan(
      repository,
      "screen.started",
      "screen.ended",
    );
    seatedSpan.current = getOpenSpan(
      repository,
      "seated.started",
      "seated.ended",
    );
    spansInitialized.current = true;
  }
  const processedBlinkEventId = useRef(0);
  const processedYawnEventId = useRef(0);
  const collectionLastObservedAt = useRef<number | null>(null);
  const latestInput = useRef(input);
  latestInput.current = input;

  useEffect(() => {
    if (input.collecting && input.observedAt !== null) {
      const previousObservedAt = collectionLastObservedAt.current;
      if (
        previousObservedAt !== null &&
        input.observedAt - previousObservedAt >
          MAX_CONTIGUOUS_OBSERVATION_GAP_MS &&
        repository.getSnapshot().activeSessionId
      ) {
        if (screenSpan.current) {
          closeScreenSpan(
            repository,
            screenSpan.current,
            screenSpan.current.lastObservedAt,
          );
          screenSpan.current = null;
        }
        if (seatedSpan.current) {
          closeSeatedSpan(
            repository,
            seatedSpan.current,
            seatedSpan.current.lastObservedAt,
            "tracking_lost",
          );
          seatedSpan.current = null;
        }
        repository.endSession(previousObservedAt);
      }
      repository.startSession(input.observedAt);
      collectionLastObservedAt.current = input.observedAt;
    }
  }, [input.collecting, input.observedAt, repository]);

  useEffect(() => {
    const current = screenSpan.current;
    if (
      !input.collecting ||
      !input.screenObserving ||
      input.observedAt === null
    ) {
      if (current && repository.getSnapshot().activeSessionId) {
        closeScreenSpan(repository, current, current.lastObservedAt);
        screenSpan.current = null;
      }
      return;
    }

    if (
      current &&
      input.observedAt - current.lastObservedAt >
        MAX_CONTIGUOUS_OBSERVATION_GAP_MS
    ) {
      closeScreenSpan(repository, current, current.lastObservedAt);
      screenSpan.current = null;
    }

    if (!screenSpan.current) {
      const spanId = createSpanId("screen");
      repository.record({
        at: input.observedAt,
        type: "screen.started",
        spanId,
      });
      screenSpan.current = {
        spanId,
        startedAt: input.observedAt,
        lastObservedAt: input.observedAt,
      };
      return;
    }
    screenSpan.current.lastObservedAt = input.observedAt;
  }, [input.collecting, input.observedAt, input.screenObserving, repository]);

  useEffect(() => {
    const unprocessed = input.blinkEvents.filter(
      (event) => event.id > processedBlinkEventId.current,
    );
    const latestEvent = unprocessed[unprocessed.length - 1];
    if (latestEvent) {
      processedBlinkEventId.current = latestEvent.id;
    }
    const snapshot = repository.getSnapshot();
    if (!input.collecting || !snapshot.activeSessionId) {
      return;
    }
    const session = snapshot.sessions.find(
      ({ id }) => id === snapshot.activeSessionId,
    );
    repository.recordMany(
      unprocessed
        .filter((event) => !session || event.at >= session.startedAt)
        .map((event) => ({ at: event.at, type: "blink.detected" as const })),
    );
  }, [input.blinkEvents, input.collecting, repository]);

  useEffect(() => {
    const unprocessed = input.yawnEvents.filter(
      (event) => event.id > processedYawnEventId.current,
    );
    const latestEvent = unprocessed[unprocessed.length - 1];
    if (latestEvent) {
      processedYawnEventId.current = latestEvent.id;
    }
    const snapshot = repository.getSnapshot();
    if (!input.collecting || !snapshot.activeSessionId) {
      return;
    }
    const session = snapshot.sessions.find(
      ({ id }) => id === snapshot.activeSessionId,
    );
    repository.recordMany(
      unprocessed
        .filter((event) => !session || event.at >= session.startedAt)
        .map((event) => ({ at: event.at, type: "yawn.detected" as const })),
    );
  }, [input.collecting, input.yawnEvents, repository]);

  useEffect(() => {
    if (!input.collecting || input.observedAt === null) {
      if (seatedSpan.current && repository.getSnapshot().activeSessionId) {
        closeSeatedSpan(
          repository,
          seatedSpan.current,
          seatedSpan.current.lastObservedAt,
          "tracking_lost",
        );
        seatedSpan.current = null;
      }
      return;
    }

    if (input.postureState === "seated") {
      if (!seatedSpan.current) {
        const snapshot = repository.getSnapshot();
        const session = snapshot.sessions.find(
          ({ id }) => id === snapshot.activeSessionId,
        );
        const startedAt = Math.max(
          session?.startedAt ?? input.observedAt,
          input.postureStateSince ?? input.observedAt,
        );
        const spanId = createSpanId("seated");
        repository.record({ at: startedAt, type: "seated.started", spanId });
        seatedSpan.current = {
          spanId,
          startedAt,
          lastObservedAt: input.observedAt,
        };
      } else {
        seatedSpan.current.lastObservedAt = input.observedAt;
      }
      return;
    }

    if (seatedSpan.current) {
      const reason: SeatedEndReason =
        input.postureState === "away" ? "stand_up" : "tracking_lost";
      closeSeatedSpan(
        repository,
        seatedSpan.current,
        input.postureStateSince ?? input.observedAt,
        reason,
      );
      seatedSpan.current = null;
    }
  }, [
    input.collecting,
    input.now,
    input.observedAt,
    input.postureState,
    input.postureStateSince,
    repository,
  ]);

  useEffect(() => {
    if (!input.collecting) {
      repository.endSession(
        collectionLastObservedAt.current ?? input.observedAt ?? input.now,
      );
      collectionLastObservedAt.current = null;
    }
  }, [input.collecting, input.now, input.observedAt, repository]);

  useEffect(
    () => () => {
      if (!repository.getSnapshot().activeSessionId) {
        return;
      }
      const at =
        collectionLastObservedAt.current ??
        latestInput.current.observedAt ??
        latestInput.current.now;
      if (screenSpan.current) {
        closeScreenSpan(
          repository,
          screenSpan.current,
          screenSpan.current.lastObservedAt,
        );
        screenSpan.current = null;
      }
      if (seatedSpan.current) {
        closeSeatedSpan(
          repository,
          seatedSpan.current,
          seatedSpan.current.lastObservedAt,
          "tracking_lost",
        );
        seatedSpan.current = null;
      }
      repository.endSession(at);
    },
    [repository],
  );
}

export function useCurrentTimelineRange(
  repository = timelineRepository,
): TimelineRange {
  const snapshot = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    repository.getSnapshot,
  );
  return useMemo(
    () => ({
      events: [...snapshot.events],
      sessions: [...snapshot.sessions],
      activeSessionId: snapshot.activeSessionId,
    }),
    [snapshot],
  );
}

export function useTimelineRange(
  from: number,
  to: number,
  repository = timelineRepository,
): TimelineRange {
  const snapshot = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    repository.getSnapshot,
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
        : { events: [], sessions: [], activeSessionId: null };
    const current = repository.getCurrentRange(from, to);
    return {
      events: mergeTimelineEvents(persisted.events, current.events),
      sessions: mergeTimelineSessions(persisted.sessions, current.sessions),
      activeSessionId: snapshot.activeSessionId,
    };
  }, [from, loadedRange, repository, snapshot, to]);
}
