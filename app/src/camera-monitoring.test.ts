import { describe, expect, it } from "vitest";
import {
  DEFAULT_CAMERA_MONITORING_SETTINGS,
  isValidMonitoringWindow,
  isWithinMonitoringWindow,
  parseCameraMonitoringSettings,
  shouldCameraRun,
} from "./camera-monitoring";

const AVAILABLE_SYSTEM = {
  screenLocked: false,
  systemSuspended: false,
};

describe("camera monitoring settings", () => {
  it("defaults to camera monitoring off", () => {
    expect(parseCameraMonitoringSettings(null)).toEqual(
      DEFAULT_CAMERA_MONITORING_SETTINGS,
    );
    expect(DEFAULT_CAMERA_MONITORING_SETTINGS).toMatchObject({
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
      startTime: "09:00",
      endTime: "21:00",
    });
    expect(parseCameraMonitoringSettings("not json")).toEqual(
      DEFAULT_CAMERA_MONITORING_SETTINGS,
    );
  });

  it("fails closed when a stored monitoring window is invalid", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          scheduleEnabled: true,
          startTime: "18:00",
          endTime: "09:00",
        }),
      ),
    ).toEqual(DEFAULT_CAMERA_MONITORING_SETTINGS);
  });

  it("keeps reminder preferences on when migrating legacy settings", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          scheduleEnabled: false,
          startTime: "09:00",
          endTime: "18:00",
        }),
      ),
    ).toEqual({
      enabled: true,
      blinkReminderEnabled: true,
      distanceReminderEnabled: true,
      scheduleEnabled: false,
      startTime: "09:00",
      endTime: "18:00",
    });
  });

  it("restores a saved distance reminder preference", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          distanceReminderEnabled: false,
          scheduleEnabled: false,
          startTime: "09:00",
          endTime: "18:00",
        }),
      ),
    ).toMatchObject({ distanceReminderEnabled: false });
  });

  it("restores a saved blink reminder preference", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          blinkReminderEnabled: false,
          distanceReminderEnabled: true,
          scheduleEnabled: false,
          startTime: "09:00",
          endTime: "18:00",
        }),
      ),
    ).toMatchObject({ blinkReminderEnabled: false });
  });

  it("accepts one same-day monitoring window", () => {
    expect(isValidMonitoringWindow("09:00", "18:00")).toBe(true);
    expect(isValidMonitoringWindow("18:00", "09:00")).toBe(false);
    expect(isValidMonitoringWindow("09:00", "09:00")).toBe(false);
  });
});

describe("camera monitoring policy", () => {
  const settings = {
    enabled: true,
    blinkReminderEnabled: true,
    distanceReminderEnabled: true,
    scheduleEnabled: true,
    startTime: "09:00",
    endTime: "21:00",
  };

  it("includes the start minute and excludes the end minute", () => {
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 9, 0).getTime(),
      ),
    ).toBe(true);
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 20, 59).getTime(),
      ),
    ).toBe(true);
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 21, 0).getTime(),
      ),
    ).toBe(false);
  });

  it("allows all local times when the schedule is disabled", () => {
    expect(
      isWithinMonitoringWindow(
        { ...settings, scheduleEnabled: false },
        new Date(2026, 7, 13, 23, 30).getTime(),
      ),
    ).toBe(true);
  });

  it("requires the master switch and every runtime gate", () => {
    const now = new Date(2026, 7, 13, 10, 0).getTime();

    expect(shouldCameraRun(settings, now, AVAILABLE_SYSTEM)).toBe(true);
    expect(
      shouldCameraRun({ ...settings, enabled: false }, now, AVAILABLE_SYSTEM),
    ).toBe(false);
    expect(
      shouldCameraRun(
        settings,
        now,
        { ...AVAILABLE_SYSTEM, screenLocked: true },
      ),
    ).toBe(false);
    expect(
      shouldCameraRun(
        settings,
        now,
        { ...AVAILABLE_SYSTEM, systemSuspended: true },
      ),
    ).toBe(false);
  });

  it("keeps local monitoring active when reminder preferences are off", () => {
    const now = new Date(2026, 7, 13, 10, 0).getTime();

    expect(
      shouldCameraRun(
        {
          ...settings,
          blinkReminderEnabled: false,
          distanceReminderEnabled: false,
        },
        now,
        AVAILABLE_SYSTEM,
      ),
    ).toBe(true);
  });
});
