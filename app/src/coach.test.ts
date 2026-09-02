import { describe, expect, it } from "vitest";
import {
  BLINK_PROMPT_COOLDOWN_MS,
  DISTANCE_DURATION_MS,
  DISTANCE_INTERVAL_MS,
  type CoachEvent,
  coachReducer,
  createCoachState,
} from "./coach";

type TickEvent = Extract<CoachEvent, { type: "TICK" }>;

function tick(
  now: number,
  overrides: Partial<Omit<TickEvent, "type" | "now">> = {},
): TickEvent {
  return {
    type: "TICK",
    now,
    sensingAvailable: true,
    coachingEnabled: true,
    blinkReminderEnabled: true,
    lowBlinkRate: false,
    distanceReminderEnabled: true,
    screenObserving: false,
    ...overrides,
  };
}

describe("coachReducer", () => {
  it("changes sensing preference without resetting reminder timing", () => {
    const initial = createCoachState(1_000, "idle", "timer");

    expect(
      coachReducer(initial, {
        type: "SET_SENSING_MODE",
        sensingMode: "camera",
      }),
    ).toEqual({ ...initial, sensingMode: "camera" });
  });

  it("starts a distance break after 20 accumulated screen minutes", () => {
    let state = createCoachState(0, "idle", "camera");
    state = coachReducer(
      state,
      tick(10 * 60_000, {
        blinkReminderEnabled: false,
        screenObserving: true,
      }),
    );
    state = coachReducer(
      state,
      tick(20 * 60_000, {
        blinkReminderEnabled: false,
        screenObserving: false,
      }),
    );
    state = coachReducer(
      state,
      tick(30 * 60_000, {
        blinkReminderEnabled: false,
        screenObserving: true,
      }),
    );

    expect(state).toMatchObject({
      mode: "distance",
      distanceObservedMs: DISTANCE_INTERVAL_MS,
      distanceStartedAt: 30 * 60_000,
    });
  });

  it("resets distance accumulation when that reminder is disabled", () => {
    const observed = coachReducer(
      createCoachState(0, "idle", "camera"),
      tick(10 * 60_000, {
        blinkReminderEnabled: false,
        screenObserving: true,
      }),
    );
    const disabled = coachReducer(
      observed,
      tick(11 * 60_000, {
        blinkReminderEnabled: false,
        distanceReminderEnabled: false,
        screenObserving: true,
      }),
    );

    expect(disabled.distanceObservedMs).toBe(0);
    expect(disabled.mode).toBe("idle");
  });

  it("preserves screen accumulation while another prompt blocks coaching", () => {
    const observed = coachReducer(
      createCoachState(0, "idle", "camera"),
      tick(5 * 60_000, {
        blinkReminderEnabled: false,
        screenObserving: true,
      }),
    );
    const blocked = coachReducer(
      observed,
      tick(6 * 60_000, {
        coachingEnabled: false,
        blinkReminderEnabled: false,
        screenObserving: true,
      }),
    );

    expect(blocked.distanceObservedMs).toBe(6 * 60_000);
    expect(blocked.mode).toBe("idle");
  });

  it("ends a completed distance break and supports skipping it", () => {
    const distance = {
      ...createCoachState(0, "distance", "camera"),
      distanceObservedMs: DISTANCE_INTERVAL_MS,
    };
    const completed = coachReducer(
      distance,
      tick(DISTANCE_DURATION_MS, { screenObserving: false }),
    );
    const skipped = coachReducer(distance, {
      type: "SKIP",
      now: 1_000,
    });

    expect(completed).toMatchObject({
      mode: "idle",
      distanceObservedMs: 0,
      distanceStartedAt: null,
    });
    expect(skipped).toMatchObject({
      mode: "idle",
      distanceObservedMs: 0,
      distanceStartedAt: null,
    });
  });

  it("starts the first blink prompt when the measured blink rate becomes low", () => {
    const initial = createCoachState(0, "idle", "camera");
    const lowRateTick = tick(15_000, { lowBlinkRate: true });

    const prompted = coachReducer(initial, lowRateTick);

    expect(prompted.mode).toBe("blink");
  });

  it("does not start a blink prompt while the measured blink rate is healthy", () => {
    const initial = createCoachState(0, "idle", "camera");
    const afterFormerThreshold = coachReducer(
      initial,
      tick(25_000, { lowBlinkRate: false }),
    );

    expect(afterFormerThreshold.mode).toBe("idle");
  });

  it("keeps later blink prompts behind the cooldown", () => {
    const initial = {
      ...createCoachState(0, "idle", "camera"),
      lastBlinkPromptAt: 0,
    };
    const duringCooldown = coachReducer(
      initial,
      tick(BLINK_PROMPT_COOLDOWN_MS - 1, { lowBlinkRate: true }),
    );
    const afterCooldown = coachReducer(
      duringCooldown,
      tick(BLINK_PROMPT_COOLDOWN_MS, { lowBlinkRate: true }),
    );

    expect(duringCooldown.mode).toBe("idle");
    expect(afterCooldown.mode).toBe("blink");
  });

  it("suppresses low-rate prompts while sensing is unavailable", () => {
    const unavailableAt = 60_000;
    const unavailable = coachReducer(
      createCoachState(0, "idle", "camera"),
      tick(unavailableAt, {
        sensingAvailable: false,
        lowBlinkRate: true,
      }),
    );
    const sensingRestored = coachReducer(
      unavailable,
      tick(unavailableAt + 1, { lowBlinkRate: true }),
    );

    expect(unavailable.mode).toBe("idle");
    expect(sensingRestored.mode).toBe("blink");
  });

  it("completes guided blinking after two detected blinks", () => {
    let state = createCoachState(0, "blink", "camera");
    state = coachReducer(state, { type: "BLINK", now: 100 });
    expect(state).toMatchObject({ mode: "blink", guidedBlinks: 1 });

    state = coachReducer(state, { type: "BLINK", now: 200 });
    expect(state).toMatchObject({
      mode: "idle",
      guidedBlinks: 2,
      lastBlinkPromptAt: 200,
    });
  });

  it("resets reminders when monitoring stops", () => {
    const active = {
      ...createCoachState(0, "blink", "camera"),
      distanceObservedMs: 5 * 60_000,
      guidedBlinks: 1,
    };
    const stopped = coachReducer(
      active,
      tick(10_000, {
        sensingAvailable: false,
        coachingEnabled: false,
        screenObserving: false,
      }),
    );

    expect(stopped).toMatchObject({
      mode: "idle",
      lastBlinkPromptAt: null,
      distanceObservedMs: 0,
      distanceStartedAt: null,
      guidedBlinks: 0,
    });
  });
});
