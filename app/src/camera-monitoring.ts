export const CAMERA_MONITORING_STORAGE_KEY =
  "look-me:camera-monitoring:v1";

export const MIN_SEDENTARY_REMINDER_MINUTES = 1;
export const MAX_SEDENTARY_REMINDER_MINUTES = 600;
export const DEFAULT_SEDENTARY_REMINDER_MINUTES = 30;

export const MIN_FORCE_LOCK_MINUTES = 1;
export const MAX_FORCE_LOCK_MINUTES = 600;
export const DEFAULT_FORCE_LOCK_MINUTES = 45;

export const MAX_MONITORING_WINDOWS = 5;

export interface MonitoringWindow {
  startTime: string;
  endTime: string;
}

export interface CameraMonitoringSettings {
  enabled: boolean;
  blinkReminderEnabled: boolean;
  distanceReminderEnabled: boolean;
  sedentaryReminderEnabled: boolean;
  sedentaryReminderMinutes: number;
  forceLockEnabled: boolean;
  forceLockMinutes: number;
  scheduleEnabled: boolean;
  windows: MonitoringWindow[];
}

export interface SystemAvailability {
  screenLocked: boolean;
  systemSuspended: boolean;
}

export const DEFAULT_CAMERA_MONITORING_SETTINGS: CameraMonitoringSettings = {
  enabled: false,
  blinkReminderEnabled: true,
  distanceReminderEnabled: true,
  sedentaryReminderEnabled: true,
  sedentaryReminderMinutes: DEFAULT_SEDENTARY_REMINDER_MINUTES,
  forceLockEnabled: false,
  forceLockMinutes: DEFAULT_FORCE_LOCK_MINUTES,
  scheduleEnabled: false,
  windows: [{ startTime: "09:00", endTime: "21:00" }],
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidMonitoringWindow(
  startTime: string,
  endTime: string,
): boolean {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return false;
  }

  return toMinuteOfDay(startTime) < toMinuteOfDay(endTime);
}

function toMinuteOfDay(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function toTimeString(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isValidMonitoringWindowValue(value: unknown): value is MonitoringWindow {
  if (
    typeof value !== "object" ||
    value === null ||
    !("startTime" in value) ||
    !("endTime" in value) ||
    typeof value.startTime !== "string" ||
    typeof value.endTime !== "string"
  ) {
    return false;
  }
  return isValidMonitoringWindow(value.startTime, value.endTime);
}

function parseMonitoringWindows(
  parsed: Record<string, unknown>,
): MonitoringWindow[] | null {
  if ("windows" in parsed) {
    const windows: unknown = parsed.windows;
    if (
      !Array.isArray(windows) ||
      windows.length === 0 ||
      windows.length > MAX_MONITORING_WINDOWS ||
      windows.some((window) => !isValidMonitoringWindowValue(window))
    ) {
      return null;
    }
    return windows;
  }

  // Legacy single-window settings migrate into a one-entry window list.
  if (
    typeof parsed.startTime === "string" &&
    typeof parsed.endTime === "string" &&
    isValidMonitoringWindow(parsed.startTime, parsed.endTime)
  ) {
    return [{ startTime: parsed.startTime, endTime: parsed.endTime }];
  }
  return null;
}

export function parseCameraMonitoringSettings(
  raw: string | null,
): CameraMonitoringSettings {
  if (!raw) {
    return DEFAULT_CAMERA_MONITORING_SETTINGS;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("enabled" in parsed) ||
      !("scheduleEnabled" in parsed) ||
      typeof parsed.enabled !== "boolean" ||
      typeof parsed.scheduleEnabled !== "boolean"
    ) {
      return DEFAULT_CAMERA_MONITORING_SETTINGS;
    }

    const windows = parseMonitoringWindows(parsed);
    if (!windows) {
      return DEFAULT_CAMERA_MONITORING_SETTINGS;
    }

    let blinkReminderEnabled = true;
    if ("blinkReminderEnabled" in parsed) {
      if (typeof parsed.blinkReminderEnabled !== "boolean") {
        return DEFAULT_CAMERA_MONITORING_SETTINGS;
      }
      blinkReminderEnabled = parsed.blinkReminderEnabled;
    }

    let distanceReminderEnabled = true;
    if ("distanceReminderEnabled" in parsed) {
      if (typeof parsed.distanceReminderEnabled !== "boolean") {
        return DEFAULT_CAMERA_MONITORING_SETTINGS;
      }
      distanceReminderEnabled = parsed.distanceReminderEnabled;
    }

    let sedentaryReminderEnabled = true;
    if ("sedentaryReminderEnabled" in parsed) {
      if (typeof parsed.sedentaryReminderEnabled !== "boolean") {
        return DEFAULT_CAMERA_MONITORING_SETTINGS;
      }
      sedentaryReminderEnabled = parsed.sedentaryReminderEnabled;
    }

    let sedentaryReminderMinutes = DEFAULT_SEDENTARY_REMINDER_MINUTES;
    if ("sedentaryReminderMinutes" in parsed) {
      if (
        typeof parsed.sedentaryReminderMinutes !== "number" ||
        !Number.isInteger(parsed.sedentaryReminderMinutes) ||
        parsed.sedentaryReminderMinutes < MIN_SEDENTARY_REMINDER_MINUTES ||
        parsed.sedentaryReminderMinutes > MAX_SEDENTARY_REMINDER_MINUTES
      ) {
        return DEFAULT_CAMERA_MONITORING_SETTINGS;
      }
      sedentaryReminderMinutes = parsed.sedentaryReminderMinutes;
    }

    let forceLockEnabled = false;
    if ("forceLockEnabled" in parsed) {
      if (typeof parsed.forceLockEnabled !== "boolean") {
        return DEFAULT_CAMERA_MONITORING_SETTINGS;
      }
      forceLockEnabled = parsed.forceLockEnabled;
    }

    let forceLockMinutes = DEFAULT_FORCE_LOCK_MINUTES;
    if ("forceLockMinutes" in parsed) {
      if (
        typeof parsed.forceLockMinutes !== "number" ||
        !Number.isInteger(parsed.forceLockMinutes) ||
        parsed.forceLockMinutes < MIN_FORCE_LOCK_MINUTES ||
        parsed.forceLockMinutes > MAX_FORCE_LOCK_MINUTES
      ) {
        return DEFAULT_CAMERA_MONITORING_SETTINGS;
      }
      forceLockMinutes = parsed.forceLockMinutes;
    }

    return {
      enabled: parsed.enabled,
      blinkReminderEnabled,
      distanceReminderEnabled,
      sedentaryReminderEnabled,
      sedentaryReminderMinutes,
      forceLockEnabled,
      forceLockMinutes,
      scheduleEnabled: parsed.scheduleEnabled,
      windows,
    };
  } catch {
    return DEFAULT_CAMERA_MONITORING_SETTINGS;
  }
}

export function isWithinMonitoringWindow(
  settings: CameraMonitoringSettings,
  now: number,
): boolean {
  if (!settings.scheduleEnabled) {
    return true;
  }

  const date = new Date(now);
  const currentMinute = date.getHours() * 60 + date.getMinutes();
  return settings.windows.some(
    (window) =>
      isValidMonitoringWindow(window.startTime, window.endTime) &&
      currentMinute >= toMinuteOfDay(window.startTime) &&
      currentMinute < toMinuteOfDay(window.endTime),
  );
}

export function getNextMonitoringWindowStart(
  settings: CameraMonitoringSettings,
  now: number,
): string | null {
  const starts = settings.windows
    .filter((window) => isValidMonitoringWindow(window.startTime, window.endTime))
    .map((window) => toMinuteOfDay(window.startTime))
    .sort((a, b) => a - b);
  if (starts.length === 0) {
    return null;
  }

  const date = new Date(now);
  const currentMinute = date.getHours() * 60 + date.getMinutes();
  const upcomingToday = starts.find((start) => start > currentMinute);
  return toTimeString(upcomingToday ?? starts[0]);
}

export function shouldCameraRun(
  settings: CameraMonitoringSettings,
  now: number,
  systemAvailability: SystemAvailability,
): boolean {
  return (
    settings.enabled &&
    !systemAvailability.screenLocked &&
    !systemAvailability.systemSuspended &&
    isWithinMonitoringWindow(settings, now)
  );
}
