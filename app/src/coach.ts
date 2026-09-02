export const DISTANCE_INTERVAL_MS = 20 * 60 * 1_000;
export const DISTANCE_DURATION_MS = 20 * 1_000;
export const BLINK_PROMPT_COOLDOWN_MS = 90 * 1_000;

export type CoachMode =
  | "permission"
  | "idle"
  | "blink"
  | "distance";

export type SensingMode = "unknown" | "camera" | "timer";

export interface CoachState {
  mode: CoachMode;
  now: number;
  sensingMode: SensingMode;
  lastBlinkPromptAt: number | null;
  distanceObservedMs: number;
  distanceStartedAt: number | null;
  guidedBlinks: number;
}

export type CoachEvent =
  | { type: "START"; now: number; sensingMode: Exclude<SensingMode, "unknown"> }
  | { type: "SET_SENSING_MODE"; sensingMode: Exclude<SensingMode, "unknown"> }
  | {
      type: "TICK";
      now: number;
      sensingAvailable: boolean;
      coachingEnabled: boolean;
      blinkReminderEnabled: boolean;
      lowBlinkRate: boolean;
      distanceReminderEnabled: boolean;
      screenObserving: boolean;
    }
  | { type: "BLINK"; now: number }
  | { type: "SKIP"; now: number };

export function createCoachState(
  now: number,
  mode: CoachMode = "permission",
  sensingMode: Exclude<SensingMode, "unknown"> = "timer",
): CoachState {
  return {
    mode,
    now,
    sensingMode: mode === "permission" ? "unknown" : sensingMode,
    lastBlinkPromptAt: null,
    distanceObservedMs: 0,
    distanceStartedAt: mode === "distance" ? now : null,
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
        lastBlinkPromptAt: null,
        distanceObservedMs: 0,
        distanceStartedAt: null,
        guidedBlinks: 0,
      };

    case "SET_SENSING_MODE":
      return {
        ...state,
        sensingMode: event.sensingMode,
      };

    case "TICK": {
      const elapsedMs = Math.max(0, event.now - state.now);
      const ticked = {
        ...state,
        now: event.now,
        distanceObservedMs: event.distanceReminderEnabled
          ? state.distanceObservedMs + (event.screenObserving ? elapsedMs : 0)
          : 0,
      };

      if (state.mode === "permission") {
        return ticked;
      }

      if (!event.coachingEnabled) {
        return {
          ...ticked,
          mode: "idle",
          lastBlinkPromptAt: null,
          distanceObservedMs: event.screenObserving
            ? ticked.distanceObservedMs
            : 0,
          distanceStartedAt: null,
          guidedBlinks: 0,
        };
      }

      if (state.mode === "distance") {
        if (!event.distanceReminderEnabled) {
          return {
            ...ticked,
            mode: "idle",
            distanceObservedMs: 0,
            distanceStartedAt: null,
            guidedBlinks: 0,
          };
        }
        if (
          state.distanceStartedAt !== null &&
          event.now - state.distanceStartedAt >= DISTANCE_DURATION_MS
        ) {
          return {
            ...ticked,
            mode: "idle",
            distanceObservedMs: 0,
            distanceStartedAt: null,
          };
        }
        return ticked;
      }

      if (state.mode === "blink") {
        if (!event.blinkReminderEnabled || !event.sensingAvailable) {
          return {
            ...ticked,
            mode: "idle",
            lastBlinkPromptAt: event.blinkReminderEnabled
              ? state.lastBlinkPromptAt
              : null,
            guidedBlinks: 0,
          };
        }
        return ticked;
      }

      if (
        event.distanceReminderEnabled &&
        ticked.distanceObservedMs >= DISTANCE_INTERVAL_MS
      ) {
        return {
          ...ticked,
          mode: "distance",
          distanceStartedAt: event.now,
          guidedBlinks: 0,
        };
      }

      if (!event.blinkReminderEnabled) {
        return {
          ...ticked,
          lastBlinkPromptAt: null,
          guidedBlinks: 0,
        };
      }

      if (!event.sensingAvailable) {
        return {
          ...ticked,
          guidedBlinks: 0,
        };
      }

      const promptCooldownElapsed =
        state.lastBlinkPromptAt === null ||
        event.now - state.lastBlinkPromptAt >= BLINK_PROMPT_COOLDOWN_MS;
      const promptDue = event.lowBlinkRate && promptCooldownElapsed;

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
        state.mode === "blink" ? Math.min(2, state.guidedBlinks + 1) : 0;
      const completedPrompt = state.mode === "blink" && guidedBlinks >= 2;
      return {
        ...state,
        mode: completedPrompt ? "idle" : state.mode,
        now: event.now,
        lastBlinkPromptAt: completedPrompt ? event.now : state.lastBlinkPromptAt,
        guidedBlinks,
      };
    }

    case "SKIP":
      return {
        ...state,
        mode: "idle",
        now: event.now,
        distanceObservedMs: 0,
        distanceStartedAt: null,
        lastBlinkPromptAt: event.now,
        guidedBlinks: 0,
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
