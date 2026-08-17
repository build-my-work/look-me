import { describe, expect, it } from "vitest";
import {
  BLINK_PROMPT_COOLDOWN_MS,
  DISTANCE_DURATION_MS,
  DISTANCE_INTERVAL_MS,
  NO_BLINK_REMINDER_MS,
  coachReducer,
  createCoachState,
} from "./coach";

describe("coachReducer", () => {
  it("changes sensing preference without resetting reminder timing", () => {
    const initial = createCoachState(1_000, "idle", "timer");
    const next = coachReducer(initial, {
      type: "SET_SENSING_MODE",
      sensingMode: "camera",
    });

    expect(next).toEqual({ ...initial, sensingMode: "camera" });
  });

  it("starts a distance break after 20 accumulated screen-facing minutes", () => {
    const initial = coachReducer(createCoachState(0), {
      type: "START",
      now: 0,
      sensingMode: "camera",
    });
    const next = coachReducer(initial, {
      type: "TICK",
      now: DISTANCE_INTERVAL_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
      distanceObservedMs: DISTANCE_INTERVAL_MS,
    });

    expect(next.mode).toBe("distance");
    expect(next.distanceStartedAt).toBe(DISTANCE_INTERVAL_MS);
  });

  it("restarts effective screen accumulation while automatic reminders are off", () => {
    const initial = coachReducer(createCoachState(0), {
      type: "START",
      now: 0,
      sensingMode: "camera",
    });
    const disabledAt = DISTANCE_INTERVAL_MS;
    const disabled = coachReducer({
      ...initial,
      lastBlinkAt: disabledAt,
      lastBlinkPromptAt: disabledAt,
    }, {
      type: "TICK",
      now: disabledAt,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: false,
    });

    expect(disabled).toMatchObject({
      mode: "idle",
      distanceObservedMs: 0,
    });

    const beforeNextInterval = coachReducer({
      ...disabled,
      lastBlinkAt: disabledAt + DISTANCE_INTERVAL_MS - 1,
      lastBlinkPromptAt: disabledAt + DISTANCE_INTERVAL_MS - 1,
    }, {
      type: "TICK",
      now: disabledAt + DISTANCE_INTERVAL_MS - 1,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
      distanceObservedMs: DISTANCE_INTERVAL_MS - 1,
    });
    expect(beforeNextInterval.mode).toBe("idle");

    const nextInterval = coachReducer(beforeNextInterval, {
      type: "TICK",
      now: disabledAt + DISTANCE_INTERVAL_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
      distanceObservedMs: DISTANCE_INTERVAL_MS,
    });
    expect(nextInterval.mode).toBe("distance");
  });

  it("ends a completed 20-second distance break", () => {
    const distance = coachReducer(createCoachState(0, "idle"), {
      type: "TICK",
      now: DISTANCE_INTERVAL_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
      distanceObservedMs: DISTANCE_INTERVAL_MS,
    });
    const next = coachReducer(distance, {
      type: "TICK",
      now: DISTANCE_INTERVAL_MS + DISTANCE_DURATION_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });

    expect(next.mode).toBe("idle");
    expect(next.distanceObservedMs).toBe(0);
  });

  it("dismisses an active automatic distance reminder when it is turned off", () => {
    const distance = coachReducer(createCoachState(0, "idle"), {
      type: "TICK",
      now: DISTANCE_INTERVAL_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
      distanceObservedMs: DISTANCE_INTERVAL_MS,
    });
    const disabledAt = DISTANCE_INTERVAL_MS + 1_000;
    const next = coachReducer(distance, {
      type: "TICK",
      now: disabledAt,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: false,
    });

    expect(next).toMatchObject({
      mode: "idle",
      distanceStartedAt: null,
      distanceObservedMs: 0,
    });
  });

  it("keeps distance reminders active when blink reminders are off", () => {
    const next = coachReducer(createCoachState(0, "idle", "camera"), {
      type: "TICK",
      now: DISTANCE_INTERVAL_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: false,
      distanceReminderEnabled: true,
      distanceObservedMs: DISTANCE_INTERVAL_MS,
    });

    expect(next.mode).toBe("distance");
  });

  it("starts the first blink prompt after 25 seconds without a blink", () => {
    const initial = createCoachState(0, "idle", "camera");
    const beforeThreshold = coachReducer(initial, {
      type: "TICK",
      now: NO_BLINK_REMINDER_MS - 1,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });
    const atThreshold = coachReducer(beforeThreshold, {
      type: "TICK",
      now: NO_BLINK_REMINDER_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });

    expect(beforeThreshold.mode).toBe("idle");
    expect(atThreshold.mode).toBe("blink");
  });

  it("keeps later blink prompts behind the 90-second cooldown", () => {
    const initial = {
      ...createCoachState(0, "idle", "camera"),
      lastBlinkPromptAt: 0,
    };
    const duringCooldown = coachReducer(initial, {
      type: "TICK",
      now: NO_BLINK_REMINDER_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });
    const afterCooldown = coachReducer(duringCooldown, {
      type: "TICK",
      now: BLINK_PROMPT_COOLDOWN_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });

    expect(duringCooldown.mode).toBe("idle");
    expect(afterCooldown.mode).toBe("blink");
  });

  it("restarts blink timing after blink reminders are re-enabled", () => {
    const disabledAt = NO_BLINK_REMINDER_MS;
    const disabled = coachReducer(
      createCoachState(0, "idle", "camera"),
      {
        type: "TICK",
        now: disabledAt,
        sensingAvailable: true,
        coachingEnabled: true,
        blinkReminderEnabled: false,
        distanceReminderEnabled: true,
      },
    );
    const beforeThreshold = coachReducer(disabled, {
      type: "TICK",
      now: disabledAt + NO_BLINK_REMINDER_MS - 1,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });
    const atThreshold = coachReducer(beforeThreshold, {
      type: "TICK",
      now: disabledAt + NO_BLINK_REMINDER_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });

    expect(disabled).toMatchObject({
      mode: "idle",
      lastBlinkAt: disabledAt,
      lastBlinkPromptAt: null,
    });
    expect(beforeThreshold.mode).toBe("idle");
    expect(atThreshold.mode).toBe("blink");
  });

  it("dismisses an active blink prompt when blink reminders are turned off", () => {
    const next = coachReducer(
      {
        ...createCoachState(0, "blink", "camera"),
        lastBlinkPromptAt: NO_BLINK_REMINDER_MS,
        guidedBlinks: 1,
      },
      {
        type: "TICK",
        now: NO_BLINK_REMINDER_MS + 1_000,
        sensingAvailable: true,
        coachingEnabled: true,
        blinkReminderEnabled: false,
        distanceReminderEnabled: true,
      },
    );

    expect(next).toMatchObject({
      mode: "idle",
      lastBlinkPromptAt: null,
      guidedBlinks: 0,
    });
  });

  it("pauses blink timing while sensing is unavailable and restarts from zero", () => {
    const initial = createCoachState(0, "idle", "camera");
    const unavailableAt = 60_000;
    const unavailable = coachReducer(initial, {
      type: "TICK",
      now: unavailableAt,
      sensingAvailable: false,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });
    const beforeThreshold = coachReducer(unavailable, {
      type: "TICK",
      now: unavailableAt + NO_BLINK_REMINDER_MS - 1,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });
    const atThreshold = coachReducer(beforeThreshold, {
      type: "TICK",
      now: unavailableAt + NO_BLINK_REMINDER_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });

    expect(unavailable).toMatchObject({
      mode: "idle",
      lastBlinkAt: unavailableAt,
    });
    expect(beforeThreshold.mode).toBe("idle");
    expect(atThreshold.mode).toBe("blink");
  });

  it("dismisses an active blink prompt as soon as sensing is unavailable", () => {
    const prompt = {
      ...createCoachState(0, "blink", "camera"),
      lastBlinkPromptAt: 0,
      guidedBlinks: 1,
    };
    const next = coachReducer(prompt, {
      type: "TICK",
      now: 1_000,
      sensingAvailable: false,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });

    expect(next).toMatchObject({
      mode: "idle",
      lastBlinkAt: 1_000,
      guidedBlinks: 0,
    });
  });

  it("completes guided blinking after two detected blinks", () => {
    let state: ReturnType<typeof createCoachState> = {
      ...createCoachState(0, "blink", "camera"),
      lastBlinkPromptAt: 0,
    };
    state = coachReducer(state, { type: "BLINK", now: 100 });
    expect(state.mode).toBe("blink");
    expect(state.guidedBlinks).toBe(1);

    state = coachReducer(state, { type: "BLINK", now: 200 });

    expect(state.mode).toBe("idle");
    expect(state.guidedBlinks).toBe(2);
    expect(state.lastBlinkPromptAt).toBe(200);
  });

  it("stops active coaching and restarts reminder timing while disabled", () => {
    const prompt = createCoachState(0, "blink", "camera");
    const disabledAt = BLINK_PROMPT_COOLDOWN_MS;
    const disabled = coachReducer(prompt, {
      type: "TICK",
      now: disabledAt,
      sensingAvailable: false,
      coachingEnabled: false,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });

    expect(disabled).toMatchObject({
      mode: "idle",
      lastBlinkAt: disabledAt,
      lastBlinkPromptAt: null,
      distanceObservedMs: 0,
      distanceStartedAt: null,
      guidedBlinks: 0,
    });

    const resumed = coachReducer(disabled, {
      type: "TICK",
      now: disabledAt + NO_BLINK_REMINDER_MS,
      sensingAvailable: true,
      coachingEnabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
    });
    expect(resumed.mode).toBe("blink");
  });
});
