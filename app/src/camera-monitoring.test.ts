import { describe, expect, it } from "vitest";
import {
  type CameraMonitoringSettings,
  DEFAULT_CAMERA_MONITORING_SETTINGS,
  getNextMonitoringWindowStart,
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
      sedentaryReminderEnabled: true,
      sedentaryReminderMinutes: 30,
      windows: [{ startTime: "09:00", endTime: "21:00" }],
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

  it("migrates legacy single-window settings into a window list", () => {
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
      sedentaryReminderEnabled: true,
      sedentaryReminderMinutes: 30,
      forceLockEnabled: false,
      forceLockMinutes: 45,
      scheduleEnabled: false,
      windows: [{ startTime: "09:00", endTime: "18:00" }],
    });
  });

  it("restores multiple stored monitoring windows", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          scheduleEnabled: true,
          windows: [
            { startTime: "09:00", endTime: "12:00" },
            { startTime: "14:00", endTime: "18:00" },
          ],
        }),
      ),
    ).toMatchObject({
      windows: [
        { startTime: "09:00", endTime: "12:00" },
        { startTime: "14:00", endTime: "18:00" },
      ],
    });
  });

  it("fails closed when any stored window entry is invalid", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          scheduleEnabled: true,
          windows: [
            { startTime: "09:00", endTime: "12:00" },
            { startTime: "20:00", endTime: "18:00" },
          ],
        }),
      ),
    ).toEqual(DEFAULT_CAMERA_MONITORING_SETTINGS);
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          scheduleEnabled: true,
          windows: [],
        }),
      ),
    ).toEqual(DEFAULT_CAMERA_MONITORING_SETTINGS);
  });

  it("restores a saved distance reminder preference", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          distanceReminderEnabled: false,
          scheduleEnabled: false,
          windows: [{ startTime: "09:00", endTime: "18:00" }],
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
          windows: [{ startTime: "09:00", endTime: "18:00" }],
        }),
      ),
    ).toMatchObject({ blinkReminderEnabled: false });
  });

  it("restores a saved sedentary reminder preference", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          blinkReminderEnabled: true,
          distanceReminderEnabled: true,
          sedentaryReminderEnabled: false,
          scheduleEnabled: false,
          windows: [{ startTime: "09:00", endTime: "18:00" }],
        }),
      ),
    ).toMatchObject({ sedentaryReminderEnabled: false });
  });

  it("restores a saved sedentary reminder interval", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          sedentaryReminderMinutes: 45,
          scheduleEnabled: false,
          windows: [{ startTime: "09:00", endTime: "18:00" }],
        }),
      ),
    ).toMatchObject({ sedentaryReminderMinutes: 45 });
  });

  it("accepts inclusive sedentary reminder interval boundaries", () => {
    for (const sedentaryReminderMinutes of [1, 600]) {
      expect(
        parseCameraMonitoringSettings(
          JSON.stringify({
            enabled: true,
            sedentaryReminderMinutes,
            scheduleEnabled: false,
            windows: [{ startTime: "09:00", endTime: "18:00" }],
          }),
        ),
      ).toMatchObject({ sedentaryReminderMinutes });
    }
  });

  it("rejects a sedentary reminder interval outside 1 to 600 minutes", () => {
    for (const sedentaryReminderMinutes of [0, 601, 30.5]) {
      expect(
        parseCameraMonitoringSettings(
          JSON.stringify({
            enabled: true,
            sedentaryReminderMinutes,
            scheduleEnabled: false,
            windows: [{ startTime: "09:00", endTime: "18:00" }],
          }),
        ),
      ).toEqual(DEFAULT_CAMERA_MONITORING_SETTINGS);
    }
  });

  it("accepts an arbitrary whole minute within the supported range", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          sedentaryReminderMinutes: 31,
          scheduleEnabled: false,
          windows: [{ startTime: "09:00", endTime: "18:00" }],
        }),
      ),
    ).toMatchObject({ sedentaryReminderMinutes: 31 });
  });

  it("defaults force lock to disabled with a 45 minute interval", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          scheduleEnabled: false,
          windows: [{ startTime: "09:00", endTime: "18:00" }],
        }),
      ),
    ).toMatchObject({ forceLockEnabled: false, forceLockMinutes: 45 });
  });

  it("restores saved force lock settings", () => {
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          forceLockEnabled: true,
          forceLockMinutes: 60,
          scheduleEnabled: false,
          windows: [{ startTime: "09:00", endTime: "18:00" }],
        }),
      ),
    ).toMatchObject({ forceLockEnabled: true, forceLockMinutes: 60 });
  });

  it("rejects force lock settings outside the supported shape", () => {
    for (const forceLockMinutes of [0, 601, 45.5]) {
      expect(
        parseCameraMonitoringSettings(
          JSON.stringify({
            enabled: true,
            forceLockMinutes,
            scheduleEnabled: false,
            windows: [{ startTime: "09:00", endTime: "18:00" }],
          }),
        ),
      ).toEqual(DEFAULT_CAMERA_MONITORING_SETTINGS);
    }
    expect(
      parseCameraMonitoringSettings(
        JSON.stringify({
          enabled: true,
          forceLockEnabled: "yes",
          scheduleEnabled: false,
          windows: [{ startTime: "09:00", endTime: "18:00" }],
        }),
      ),
    ).toEqual(DEFAULT_CAMERA_MONITORING_SETTINGS);
  });

  it("accepts one same-day monitoring window", () => {
    expect(isValidMonitoringWindow("09:00", "18:00")).toBe(true);
    expect(isValidMonitoringWindow("18:00", "09:00")).toBe(false);
    expect(isValidMonitoringWindow("09:00", "09:00")).toBe(false);
  });
});

describe("camera monitoring policy", () => {
  const settings: CameraMonitoringSettings = {
    enabled: true,
    blinkReminderEnabled: true,
    distanceReminderEnabled: true,
    sedentaryReminderEnabled: true,
    sedentaryReminderMinutes: 30,
    forceLockEnabled: false,
    forceLockMinutes: 45,
    scheduleEnabled: true,
    windows: [
      { startTime: "09:00", endTime: "12:00" },
      { startTime: "14:00", endTime: "18:00" },
    ],
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
        new Date(2026, 7, 13, 11, 59).getTime(),
      ),
    ).toBe(true);
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 12, 0).getTime(),
      ),
    ).toBe(false);
  });

  it("monitors during any configured window and pauses between them", () => {
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 10, 0).getTime(),
      ),
    ).toBe(true);
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 13, 0).getTime(),
      ),
    ).toBe(false);
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 16, 30).getTime(),
      ),
    ).toBe(true);
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 22, 0).getTime(),
      ),
    ).toBe(false);
    expect(
      isWithinMonitoringWindow(
        settings,
        new Date(2026, 7, 13, 7, 30).getTime(),
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

  it("reports the next window start while outside every window", () => {
    // Between windows: the second window resumes today.
    expect(
      getNextMonitoringWindowStart(
        settings,
        new Date(2026, 7, 13, 13, 0).getTime(),
      ),
    ).toBe("14:00");
    // Before all windows: the first window resumes today.
    expect(
      getNextMonitoringWindowStart(
        settings,
        new Date(2026, 7, 13, 7, 30).getTime(),
      ),
    ).toBe("09:00");
    // After all windows: the earliest window resumes tomorrow.
    expect(
      getNextMonitoringWindowStart(
        settings,
        new Date(2026, 7, 13, 22, 0).getTime(),
      ),
    ).toBe("09:00");
    // Windows are read in time order regardless of stored order.
    expect(
      getNextMonitoringWindowStart(
        { ...settings, windows: [...settings.windows].reverse() },
        new Date(2026, 7, 13, 13, 0).getTime(),
      ),
    ).toBe("14:00");
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
          sedentaryReminderEnabled: false,
        },
        now,
        AVAILABLE_SYSTEM,
      ),
    ).toBe(true);
  });
});
