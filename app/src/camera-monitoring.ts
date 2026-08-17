export const CAMERA_MONITORING_STORAGE_KEY =
  "look-me:camera-monitoring:v1";

export const MIN_SEDENTARY_REMINDER_MINUTES = 1;
export const MAX_SEDENTARY_REMINDER_MINUTES = 600;
export const DEFAULT_SEDENTARY_REMINDER_MINUTES = 30;

export interface CameraMonitoringSettings {
  enabled: boolean;
  blinkReminderEnabled: boolean;
  distanceReminderEnabled: boolean;
  sedentaryReminderEnabled: boolean;
  sedentaryReminderMinutes: number;
  scheduleEnabled: boolean;
  startTime: string;
  endTime: string;
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
  scheduleEnabled: false,
  startTime: "09:00",
  endTime: "21:00",
};

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function isValidMonitoringWindow(
  startTime: string,
  endTime: string,
): boolean {
  if (!TIME_PATTERN.test(startTime) || !TIME_PATTERN.test(endTime)) {
    return false;
  }

  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  return startHour * 60 + startMinute < endHour * 60 + endMinute;
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
      !("startTime" in parsed) ||
      !("endTime" in parsed) ||
      typeof parsed.enabled !== "boolean" ||
      typeof parsed.scheduleEnabled !== "boolean" ||
      typeof parsed.startTime !== "string" ||
      typeof parsed.endTime !== "string" ||
      !isValidMonitoringWindow(parsed.startTime, parsed.endTime)
    ) {
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

    return {
      enabled: parsed.enabled,
      blinkReminderEnabled,
      distanceReminderEnabled,
      sedentaryReminderEnabled,
      sedentaryReminderMinutes,
      scheduleEnabled: parsed.scheduleEnabled,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
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
  if (!isValidMonitoringWindow(settings.startTime, settings.endTime)) {
    return false;
  }

  const date = new Date(now);
  const currentMinute = date.getHours() * 60 + date.getMinutes();
  const [startHour, startMinute] = settings.startTime.split(":").map(Number);
  const [endHour, endMinute] = settings.endTime.split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return currentMinute >= start && currentMinute < end;
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
