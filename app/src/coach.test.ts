import { describe, expect, it } from "vitest";
import {
  BLINK_PROMPT_AUTO_DISMISS_MS,
  BLINK_PROMPT_COOLDOWN_MS,
  DISTANCE_DURATION_MS,
  DISTANCE_INTERVAL_MS,
  FALLBACK_BLINK_REMINDER_MS,
  NO_BLINK_REMINDER_MS,
  coachReducer,
  createCoachState,
} from "./coach";

describe("coachReducer", () => {
  it("starts a distance break when the 20-minute interval is due", () => {
    const initial = coachReducer(createCoachState(0), {
      type: "START",
      now: 0,
      sensingMode: "camera",
    });
    const next = coachReducer(initial, {
      type: "TICK",
      now: DISTANCE_INTERVAL_MS,
      sensingAvailable: true,
    });

    expect(next.mode).toBe("distance");
    expect(next.distanceStartedAt).toBe(DISTANCE_INTERVAL_MS);
  });

  it("ends a completed 20-second distance break", () => {
    const distance = coachReducer(createCoachState(0, "idle"), {
      type: "START_DISTANCE",
      now: 10,
    });
    const next = coachReducer(distance, {
      type: "TICK",
      now: 10 + DISTANCE_DURATION_MS,
      sensingAvailable: true,
    });

    expect(next.mode).toBe("idle");
    expect(next.nextDistanceAt).toBe(10 + DISTANCE_DURATION_MS + DISTANCE_INTERVAL_MS);
  });

  it("uses blink silence only after the prompt cooldown", () => {
    const initial = {
      ...createCoachState(0, "idle"),
      sensingMode: "camera" as const,
      lastBlinkPromptAt: -BLINK_PROMPT_COOLDOWN_MS,
    };
    const next = coachReducer(initial, {
      type: "TICK",
      now: NO_BLINK_REMINDER_MS,
      sensingAvailable: true,
    });

    expect(next.mode).toBe("blink");
  });

  it("falls back to a timer prompt when sensing is unavailable", () => {
    const initial = createCoachState(0, "idle");
    const next = coachReducer(initial, {
      type: "TICK",
      now: FALLBACK_BLINK_REMINDER_MS,
      sensingAvailable: false,
    });

    expect(next.mode).toBe("blink");
  });

  it("auto-dismisses a fallback blink prompt without a manual completion button", () => {
    const prompt = createCoachState(0, "blink");

    expect(coachReducer(prompt, {
      type: "TICK",
      now: BLINK_PROMPT_AUTO_DISMISS_MS - 1,
      sensingAvailable: false,
    }).mode).toBe("blink");
    expect(coachReducer(prompt, {
      type: "TICK",
      now: BLINK_PROMPT_AUTO_DISMISS_MS,
      sensingAvailable: false,
    }).mode).toBe("idle");
  });

  it("keeps waiting for confirmed blinks while sensing remains available", () => {
    const prompt = createCoachState(0, "blink");
    const next = coachReducer(prompt, {
      type: "TICK",
      now: BLINK_PROMPT_AUTO_DISMISS_MS,
      sensingAvailable: true,
    });

    expect(next.mode).toBe("blink");
  });

  it("completes guided blinking after three detected blinks", () => {
    let state = createCoachState(0, "blink");
    state = coachReducer(state, { type: "BLINK", now: 100 });
    state = coachReducer(state, { type: "BLINK", now: 200 });
    state = coachReducer(state, { type: "BLINK", now: 300 });

    expect(state.mode).toBe("idle");
    expect(state.guidedBlinks).toBe(3);
  });
});
