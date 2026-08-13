import { useEffect, useRef, useState } from "react";
import { formatLocalDateKey } from "./local-history-time";
import {
  POSTURE_HISTORY_STORAGE_KEY,
  type PostureHistory,
  type RecordedPostureState,
  createPostureHistory,
  parsePostureHistory,
  prunePostureHistory,
  recordPostureInterval,
  recordStandUp,
} from "./posture-history";
import type { PostureState } from "./posture-signal";

const MAX_CONTIGUOUS_OBSERVATION_GAP_MS = 1_500;
const PERSIST_INTERVAL_MS = 3_000;

function isRecordedState(state: PostureState): state is RecordedPostureState {
  return state === "seated" || state === "away";
}

export function usePostureHistory(
  postureState: PostureState,
  standUpTimestamps: readonly number[],
  monitoring: boolean,
  now: number,
): PostureHistory {
  const [history, setHistory] = useState(() => {
    try {
      const stored = parsePostureHistory(
        window.localStorage.getItem(POSTURE_HISTORY_STORAGE_KEY),
      );
      return prunePostureHistory(stored, formatLocalDateKey(Date.now()));
    } catch {
      return createPostureHistory();
    }
  });
  const previousSample = useRef<{
    timestamp: number;
    state: RecordedPostureState;
  } | null>(null);
  const processedStandUpCount = useRef(0);
  const historyRef = useRef(history);
  const historyIsDirty = useRef(false);

  useEffect(() => {
    historyRef.current = history;
    historyIsDirty.current = true;
  }, [history]);

  useEffect(() => {
    const persist = () => {
      if (!historyIsDirty.current) {
        return;
      }
      try {
        window.localStorage.setItem(
          POSTURE_HISTORY_STORAGE_KEY,
          JSON.stringify(historyRef.current),
        );
        historyIsDirty.current = false;
      } catch {
        // Statistics remain available in memory if local storage is unavailable.
      }
    };
    const timer = window.setInterval(persist, PERSIST_INTERVAL_MS);
    window.addEventListener("beforeunload", persist);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", persist);
      persist();
    };
  }, []);

  useEffect(() => {
    const canRecord =
      monitoring &&
      document.visibilityState === "visible" &&
      isRecordedState(postureState);
    if (!canRecord) {
      previousSample.current = null;
      return;
    }

    const previous = previousSample.current;
    previousSample.current = { timestamp: now, state: postureState };
    if (
      previous === null ||
      previous.state !== postureState ||
      now <= previous.timestamp ||
      now - previous.timestamp > MAX_CONTIGUOUS_OBSERVATION_GAP_MS
    ) {
      return;
    }

    setHistory((current) =>
      prunePostureHistory(
        recordPostureInterval(
          current,
          postureState,
          previous.timestamp,
          now,
        ),
        formatLocalDateKey(now),
      ),
    );
  }, [monitoring, now, postureState]);

  useEffect(() => {
    if (standUpTimestamps.length < processedStandUpCount.current) {
      processedStandUpCount.current = 0;
    }
    const unprocessed = standUpTimestamps.slice(processedStandUpCount.current);
    processedStandUpCount.current = standUpTimestamps.length;
    if (unprocessed.length === 0) {
      return;
    }

    setHistory((current) => {
      let next = current;
      for (const timestamp of unprocessed) {
        next = recordStandUp(next, timestamp);
      }
      return prunePostureHistory(next, formatLocalDateKey(Date.now()));
    });
  }, [standUpTimestamps]);

  return history;
}
