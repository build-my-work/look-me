import { describe, expect, it } from "vitest";
import { SedentaryReminder } from "./sedentary-reminder";

const THRESHOLD_MS = 30 * 60 * 1_000;

const ACTIVE_SEATED = {
  monitoring: true,
  enabled: true,
  postureState: "seated" as const,
  canPrompt: true,
  thresholdMs: THRESHOLD_MS,
};

describe("sedentary reminder", () => {
  it("activates after the configured continuous seated interval", () => {
    const reminder = new SedentaryReminder();

    expect(reminder.update({ ...ACTIVE_SEATED, now: 1_000 })).toBe(false);
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: 1_000 + THRESHOLD_MS - 1,
      }),
    ).toBe(false);
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: 1_000 + THRESHOLD_MS,
      }),
    ).toBe(true);
  });

  it("waits until another coaching card is no longer active", () => {
    const reminder = new SedentaryReminder();

    reminder.update({ ...ACTIVE_SEATED, now: 0 });
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: THRESHOLD_MS,
        canPrompt: false,
      }),
    ).toBe(false);
    expect(
      reminder.update({ ...ACTIVE_SEATED, now: THRESHOLD_MS + 1 }),
    ).toBe(true);
  });

  it("resets after leaving the seated state", () => {
    const reminder = new SedentaryReminder();

    reminder.update({ ...ACTIVE_SEATED, now: 0 });
    expect(
      reminder.update({ ...ACTIVE_SEATED, now: THRESHOLD_MS }),
    ).toBe(true);
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: THRESHOLD_MS + 1,
        postureState: "away",
      }),
    ).toBe(false);
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: THRESHOLD_MS * 2,
      }),
    ).toBe(false);
  });

  it("starts a fresh interval after being disabled", () => {
    const reminder = new SedentaryReminder();

    reminder.update({ ...ACTIVE_SEATED, now: 0 });
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: THRESHOLD_MS,
        enabled: false,
      }),
    ).toBe(false);
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: THRESHOLD_MS + 1,
      }),
    ).toBe(false);
  });

  it("does not repeat after acknowledgement until the next seated interval", () => {
    const reminder = new SedentaryReminder();

    reminder.update({ ...ACTIVE_SEATED, now: 0 });
    expect(
      reminder.update({ ...ACTIVE_SEATED, now: THRESHOLD_MS }),
    ).toBe(true);

    reminder.acknowledge();
    expect(
      reminder.update({ ...ACTIVE_SEATED, now: THRESHOLD_MS * 2 }),
    ).toBe(false);

    reminder.update({
      ...ACTIVE_SEATED,
      now: THRESHOLD_MS * 2 + 1,
      postureState: "unknown",
    });
    reminder.update({ ...ACTIVE_SEATED, now: THRESHOLD_MS * 2 + 2 });
    expect(
      reminder.update({ ...ACTIVE_SEATED, now: THRESHOLD_MS * 3 + 2 }),
    ).toBe(true);
  });

  it("applies a shorter interval to the current seated period", () => {
    const reminder = new SedentaryReminder();

    reminder.update({
      ...ACTIVE_SEATED,
      now: 0,
      thresholdMs: 60 * 60 * 1_000,
    });
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: THRESHOLD_MS,
        thresholdMs: 60 * 60 * 1_000,
      }),
    ).toBe(false);
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: THRESHOLD_MS,
      }),
    ).toBe(true);
  });

  it("dismisses an active reminder when the interval is increased", () => {
    const reminder = new SedentaryReminder();

    reminder.update({ ...ACTIVE_SEATED, now: 0 });
    expect(
      reminder.update({ ...ACTIVE_SEATED, now: THRESHOLD_MS }),
    ).toBe(true);
    expect(
      reminder.update({
        ...ACTIVE_SEATED,
        now: THRESHOLD_MS,
        thresholdMs: 60 * 60 * 1_000,
      }),
    ).toBe(false);
  });

});
