export const DISTANCE_INTERVAL_MS = 20 * 60 * 1_000;
export const DISTANCE_DURATION_MS = 20 * 1_000;
export const NO_BLINK_REMINDER_MS = 25 * 1_000;
export const FALLBACK_BLINK_REMINDER_MS = 45 * 1_000;
export const BLINK_PROMPT_COOLDOWN_MS = 90 * 1_000;
export const BLINK_PROMPT_AUTO_DISMISS_MS = 6 * 1_000;
export const PAUSE_DURATION_MS = 25 * 60 * 1_000;

export type CoachMode =
  | "permission"
  | "idle"
  | "blink"
  | "distance"
  | "paused";

export type SensingMode = "unknown" | "camera" | "timer";

export interface CoachState {
  mode: CoachMode;
  now: number;
  sensingMode: SensingMode;
  lastBlinkAt: number;
  lastBlinkPromptAt: number;
  nextDistanceAt: number;
  distanceStartedAt: number | null;
  pausedUntil: number | null;
  guidedBlinks: number;
}

export type CoachEvent =
  | { type: "START"; now: number; sensingMode: Exclude<SensingMode, "unknown"> }
  | { type: "TICK"; now: number; sensingAvailable: boolean }
  | { type: "BLINK"; now: number }
  | { type: "START_DISTANCE"; now: number }
  | { type: "SKIP"; now: number }
  | { type: "PAUSE"; now: number }
  | { type: "RESUME"; now: number };

export function createCoachState(
  now: number,
  mode: CoachMode = "permission",
): CoachState {
  return {
    mode,
    now,
    sensingMode: mode === "permission" ? "unknown" : "timer",
    lastBlinkAt: now,
    lastBlinkPromptAt: now,
    nextDistanceAt: now + DISTANCE_INTERVAL_MS,
    distanceStartedAt: mode === "distance" ? now : null,
    pausedUntil: mode === "paused" ? now + PAUSE_DURATION_MS : null,
    guidedBlinks: 0,
  };
}

export function coachReducer(
  state: CoachState,
  event: CoachEvent,
): CoachState {
  switch (event.type) {
    case "START":
      return {
        ...state,
        mode: "idle",
        now: event.now,
        sensingMode: event.sensingMode,
        lastBlinkAt: event.now,
        lastBlinkPromptAt: event.now,
        nextDistanceAt: event.now + DISTANCE_INTERVAL_MS,
        distanceStartedAt: null,
        pausedUntil: null,
        guidedBlinks: 0,
      };

    case "TICK": {
      const ticked = { ...state, now: event.now };

      if (state.mode === "permission") {
        return ticked;
      }

      if (state.mode === "paused") {
        if (state.pausedUntil !== null && event.now >= state.pausedUntil) {
          return {
            ...ticked,
            mode: "idle",
            pausedUntil: null,
            lastBlinkAt: event.now,
            lastBlinkPromptAt: event.now,
            nextDistanceAt: event.now + DISTANCE_INTERVAL_MS,
          };
        }
        return ticked;
      }

      if (state.mode === "distance") {
        if (
          state.distanceStartedAt !== null &&
          event.now - state.distanceStartedAt >= DISTANCE_DURATION_MS
        ) {
          return {
            ...ticked,
            mode: "idle",
            distanceStartedAt: null,
            nextDistanceAt: event.now + DISTANCE_INTERVAL_MS,
            lastBlinkAt: event.now,
          };
        }
        return ticked;
      }

      if (state.mode === "blink") {
        if (
          !event.sensingAvailable &&
          event.now - state.lastBlinkPromptAt >= BLINK_PROMPT_AUTO_DISMISS_MS
        ) {
          return {
            ...ticked,
            mode: "idle",
            lastBlinkAt: event.now,
            guidedBlinks: 0,
          };
        }
        return ticked;
      }

      if (event.now >= state.nextDistanceAt) {
        return {
          ...ticked,
          mode: "distance",
          distanceStartedAt: event.now,
          guidedBlinks: 0,
        };
      }

      const blinkSilence = event.now - state.lastBlinkAt;
      const promptSilence = event.now - state.lastBlinkPromptAt;
      const promptDue = event.sensingAvailable
        ? blinkSilence >= NO_BLINK_REMINDER_MS &&
          promptSilence >= BLINK_PROMPT_COOLDOWN_MS
        : promptSilence >= FALLBACK_BLINK_REMINDER_MS;

      if (promptDue) {
        return {
          ...ticked,
          mode: "blink",
          lastBlinkPromptAt: event.now,
          guidedBlinks: 0,
        };
      }

      return ticked;
    }

    case "BLINK": {
      const guidedBlinks =
        state.mode === "blink" ? Math.min(3, state.guidedBlinks + 1) : 0;
      return {
        ...state,
        mode: guidedBlinks >= 3 ? "idle" : state.mode,
        now: event.now,
        lastBlinkAt: event.now,
        guidedBlinks,
      };
    }

    case "START_DISTANCE":
      return {
        ...state,
        mode: "distance",
        now: event.now,
        distanceStartedAt: event.now,
        guidedBlinks: 0,
      };

    case "SKIP":
      return {
        ...state,
        mode: "idle",
        now: event.now,
        distanceStartedAt: null,
        nextDistanceAt: event.now + DISTANCE_INTERVAL_MS,
        lastBlinkAt: event.now,
        lastBlinkPromptAt: event.now,
        guidedBlinks: 0,
      };

    case "PAUSE":
      return {
        ...state,
        mode: "paused",
        now: event.now,
        pausedUntil: event.now + PAUSE_DURATION_MS,
        distanceStartedAt: null,
        nextDistanceAt: event.now + PAUSE_DURATION_MS + DISTANCE_INTERVAL_MS,
        guidedBlinks: 0,
      };

    case "RESUME":
      return {
        ...state,
        mode: "idle",
        now: event.now,
        pausedUntil: null,
        lastBlinkAt: event.now,
        lastBlinkPromptAt: event.now,
        nextDistanceAt: event.now + DISTANCE_INTERVAL_MS,
      };
  }
}

export function getDistanceSecondsRemaining(state: CoachState): number {
  if (state.distanceStartedAt === null) {
    return Math.ceil(DISTANCE_DURATION_MS / 1_000);
  }
  return Math.max(
    0,
    Math.ceil((DISTANCE_DURATION_MS - (state.now - state.distanceStartedAt)) / 1_000),
  );
}

export function getDistanceProgress(state: CoachState): number {
  if (state.distanceStartedAt === null) {
    return 0;
  }
  return Math.min(
    100,
    Math.max(0, ((state.now - state.distanceStartedAt) / DISTANCE_DURATION_MS) * 100),
  );
}
