import { useEffect, useRef, useState } from "react";
import {
  BLINK_HISTORY_STORAGE_KEY,
  type BlinkHistory,
  createBlinkHistory,
  formatLocalDateKey,
  parseBlinkHistory,
  pruneBlinkHistory,
  recordBlink,
  recordObservedInterval,
} from "./blink-history";

const MAX_CONTIGUOUS_OBSERVATION_GAP_MS = 1_500;
const PERSIST_INTERVAL_MS = 3_000;

export function useBlinkHistory(
  blinkTimestamps: readonly number[],
  observing: boolean,
  now: number,
): BlinkHistory {
  const [history, setHistory] = useState(() => {
    try {
      const stored = parseBlinkHistory(
        window.localStorage.getItem(BLINK_HISTORY_STORAGE_KEY),
      );
      return pruneBlinkHistory(stored, formatLocalDateKey(Date.now()));
    } catch {
      return createBlinkHistory();
    }
  });
  const previousObservationAt = useRef<number | null>(null);
  const processedBlinkCount = useRef(0);
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
          BLINK_HISTORY_STORAGE_KEY,
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
    const canObserve = observing && document.visibilityState === "visible";
    if (!canObserve) {
      previousObservationAt.current = null;
      return;
    }

    const previous = previousObservationAt.current;
    previousObservationAt.current = now;
    if (
      previous === null ||
      now <= previous ||
      now - previous > MAX_CONTIGUOUS_OBSERVATION_GAP_MS
    ) {
      return;
    }

    setHistory((current) =>
      pruneBlinkHistory(
        recordObservedInterval(current, previous, now),
        formatLocalDateKey(now),
      ),
    );
  }, [now, observing]);

  useEffect(() => {
    if (blinkTimestamps.length < processedBlinkCount.current) {
      processedBlinkCount.current = 0;
    }
    const unprocessed = blinkTimestamps.slice(processedBlinkCount.current);
    processedBlinkCount.current = blinkTimestamps.length;
    if (unprocessed.length === 0) {
      return;
    }

    setHistory((current) => {
      let next = current;
      for (const timestamp of unprocessed) {
        next = recordBlink(next, timestamp);
      }
      return pruneBlinkHistory(next, formatLocalDateKey(Date.now()));
    });
  }, [blinkTimestamps]);

  return history;
}
