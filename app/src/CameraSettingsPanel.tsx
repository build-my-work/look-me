import {
  ArrowsClockwise,
  Camera,
  CaretDown,
  CaretUp,
  Clock,
  GearSix,
  HandsClapping,
  MoonStars,
  PersonSimple,
  Plus,
  Prohibit,
  Shuffle,
  Sparkle,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
  MAX_FORCE_LOCK_MINUTES,
  MAX_MONITORING_WINDOWS,
  MAX_SEDENTARY_REMINDER_MINUTES,
  MIN_FORCE_LOCK_MINUTES,
  MIN_SEDENTARY_REMINDER_MINUTES,
  type CameraMonitoringSettings,
  type MonitoringWindow,
  isValidMonitoringWindow,
} from "./camera-monitoring";
import type { PetIdleActionPreference } from "./pet-idle-action";

type CameraStatusTone = "active" | "waiting" | "off" | "error";

const HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);
const PET_ACTION_OPTIONS = [
  { value: "auto", label: "自动轮换", Icon: Shuffle },
  { value: "yawn", label: "打哈欠", Icon: MoonStars },
  { value: "clap", label: "鼓掌", Icon: HandsClapping },
  { value: "sit", label: "坐下", Icon: PersonSimple },
  { value: "spin", label: "转圈", Icon: ArrowsClockwise },
  { value: "off", label: "保持安静", Icon: Prohibit },
] satisfies Array<{
  value: PetIdleActionPreference;
  label: string;
  Icon: typeof Shuffle;
}>;

const NEW_MONITORING_WINDOW: MonitoringWindow = {
  startTime: "14:00",
  endTime: "18:00",
};

interface CameraSettingsPanelProps {
  settings: CameraMonitoringSettings;
  statusLabel: string;
  statusTone: CameraStatusTone;
  petAction: PetIdleActionPreference;
  onChange: (settings: CameraMonitoringSettings) => void;
  onPetActionChange: (action: PetIdleActionPreference) => void;
  onClose: () => void;
}

export function CameraSettingsPanel({
  settings,
  statusLabel,
  statusTone,
  petAction,
  onChange,
  onPetActionChange,
  onClose,
}: CameraSettingsPanelProps) {
  const [windows, setWindows] = useState(settings.windows);
  const [scheduleExpanded, setScheduleExpanded] = useState(false);
  const [sedentaryMinutes, setSedentaryMinutes] = useState(
    String(settings.sedentaryReminderMinutes),
  );
  const [forceLockMinutes, setForceLockMinutes] = useState(
    String(settings.forceLockMinutes),
  );
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    setWindows(settings.windows);
  }, [settings.windows]);

  useEffect(() => {
    setSedentaryMinutes(String(settings.sedentaryReminderMinutes));
  }, [settings.sedentaryReminderMinutes]);

  useEffect(() => {
    setForceLockMinutes(String(settings.forceLockMinutes));
  }, [settings.forceLockMinutes]);

  const scheduleControlsEnabled = settings.enabled && settings.scheduleEnabled;
  const parsedSedentaryMinutes = Number(sedentaryMinutes);
  const validSedentaryMinutes =
    sedentaryMinutes !== "" &&
    Number.isInteger(parsedSedentaryMinutes) &&
    parsedSedentaryMinutes >= MIN_SEDENTARY_REMINDER_MINUTES &&
    parsedSedentaryMinutes <= MAX_SEDENTARY_REMINDER_MINUTES;
  const parsedForceLockMinutes = Number(forceLockMinutes);
  const validForceLockMinutes =
    forceLockMinutes !== "" &&
    Number.isInteger(parsedForceLockMinutes) &&
    parsedForceLockMinutes >= MIN_FORCE_LOCK_MINUTES &&
    parsedForceLockMinutes <= MAX_FORCE_LOCK_MINUTES;

  const updateWindow = (index: number, patch: Partial<MonitoringWindow>) => {
    setWindows((previous) =>
      previous.map((window, windowIndex) =>
        windowIndex === index ? { ...window, ...patch } : window,
      ),
    );
  };

  const removeWindow = (index: number) => {
    setWindows((previous) =>
      previous.length <= 1
        ? previous
        : previous.filter((_, windowIndex) => windowIndex !== index),
    );
  };

  const addWindow = () => {
    setWindows((previous) =>
      previous.length >= MAX_MONITORING_WINDOWS
        ? previous
        : [...previous, { ...NEW_MONITORING_WINDOW }],
    );
  };

  useEffect(() => {
    const currentWindows = settingsRef.current.windows;
    if (
      windows.length === currentWindows.length &&
      windows.every(
        (window, index) =>
          window.startTime === currentWindows[index].startTime &&
          window.endTime === currentWindows[index].endTime,
      )
    ) {
      return;
    }
    if (
      windows.length === 0 ||
      windows.some(
        (window) => !isValidMonitoringWindow(window.startTime, window.endTime),
      )
    ) {
      return;
    }
    onChange({ ...settingsRef.current, windows });
  }, [onChange, windows]);

  // 桌面端窗口高度跟随面板内容：时段行数变化时上报所需高度，主进程调整窗口。
  // 上报内容高度（scrollHeight + 底部留白 14px），与窗口位置无关，
  // 避免窗口移动后重测底边坐标造成的高度振荡。
  // 注意：面板有 max-height 兜底，内容增多时面板盒子可能不变，
  // 所以除了观察面板本身，还要观察内容区并在折叠切换时主动重报。
  const panelRef = useRef<HTMLElement | null>(null);
  const reportHeightRef = useRef<() => void>(() => {});
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || typeof ResizeObserver === "undefined") {
      return;
    }
    let frame = 0;
    const report = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const neededHeight = Math.ceil(panel.scrollHeight) + 14;
        if (Number.isFinite(neededHeight) && neededHeight > 0) {
          window.lookMe?.syncCameraSettingsHeight(neededHeight);
        }
      });
    };
    reportHeightRef.current = report;
    const observer = new ResizeObserver(report);
    observer.observe(panel);
    const body = panel.querySelector(".camera-settings-body");
    if (body) {
      observer.observe(body);
    }
    report();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    reportHeightRef.current();
  }, [scheduleExpanded, windows]);

  return (
    <article
      ref={panelRef}
      className="camera-settings-panel"
      data-camera-settings
      data-interactive
      aria-labelledby="camera-settings-title"
    >
      <header className="camera-settings-header">
        <span className="camera-settings-mark" aria-hidden>
          <GearSix size={22} weight="fill" />
        </span>
        <div>
          <span className="camera-settings-eyebrow">猫咪陪伴</span>
          <h2 id="camera-settings-title">设置</h2>
        </div>
        <button
          className="camera-settings-close"
          type="button"
          aria-label="关闭设置"
          onClick={onClose}
        >
          <X size={17} weight="bold" aria-hidden />
        </button>
      </header>

      <div className="camera-settings-body">
        <section className="camera-monitoring-settings" aria-labelledby="monitoring-title">
          <div className="camera-settings-section-heading">
            <Camera size={14} weight="fill" aria-hidden />
            <strong id="monitoring-title">监测与提醒</strong>
            <span className={`camera-runtime-status camera-runtime-status--${statusTone}`}>
              {statusLabel}
            </span>
          </div>

          <div
            data-reminder="blink"
            className={
              settings.enabled
                ? "camera-reminder-row"
                : "camera-reminder-row camera-reminder-row--disabled"
            }
          >
            <div>
              <strong>眨眼提醒</strong>
              <span>连续 25 秒未眨眼时提醒</span>
            </div>
            <label className="camera-switch camera-switch--small">
              <span className="sr-only">开启眨眼提醒</span>
              <input
                type="checkbox"
                checked={settings.blinkReminderEnabled}
                disabled={!settings.enabled}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    blinkReminderEnabled: event.target.checked,
                  })
                }
              />
              <span className="camera-switch-track" aria-hidden />
            </label>
          </div>

          <div
            data-reminder="distance"
            className={
              settings.enabled
                ? "camera-reminder-row"
                : "camera-reminder-row camera-reminder-row--disabled"
            }
          >
            <div>
              <strong>远眺提醒</strong>
              <span>每 20 分钟提醒远眺 20 秒</span>
            </div>
            <label className="camera-switch camera-switch--small">
              <span className="sr-only">开启远眺提醒</span>
              <input
                type="checkbox"
                checked={settings.distanceReminderEnabled}
                disabled={!settings.enabled}
                onChange={(event) =>
                  onChange({
                    ...settings,
                    distanceReminderEnabled: event.target.checked,
                  })
                }
              />
              <span className="camera-switch-track" aria-hidden />
            </label>
          </div>

          <div
            data-reminder="sedentary"
            className={
              settings.enabled
                ? "camera-reminder-row"
                : "camera-reminder-row camera-reminder-row--disabled"
            }
          >
            <div>
              <strong>久坐提醒</strong>
              <span>可设置 1–600 分钟</span>
            </div>
            <span className="sedentary-reminder-controls">
              <input
                className="sedentary-reminder-interval"
                type="number"
                inputMode="numeric"
                aria-label="久坐提醒时间"
                aria-invalid={!validSedentaryMinutes}
                min={MIN_SEDENTARY_REMINDER_MINUTES}
                max={MAX_SEDENTARY_REMINDER_MINUTES}
                step={1}
                value={sedentaryMinutes}
                disabled={
                  !settings.enabled || !settings.sedentaryReminderEnabled
                }
                onChange={(event) => {
                  const value = event.target.value;
                  const minutes = Number(value);
                  setSedentaryMinutes(value);
                  if (
                    value !== "" &&
                    Number.isInteger(minutes) &&
                    minutes >= MIN_SEDENTARY_REMINDER_MINUTES &&
                    minutes <= MAX_SEDENTARY_REMINDER_MINUTES
                  ) {
                    onChange({
                      ...settings,
                      sedentaryReminderMinutes: minutes,
                    });
                  }
                }}
                onBlur={() =>
                  setSedentaryMinutes(
                    String(settingsRef.current.sedentaryReminderMinutes),
                  )
                }
              />
              <span className="sedentary-reminder-unit">分钟</span>
              <label className="camera-switch camera-switch--small">
                <span className="sr-only">开启久坐提醒</span>
                <input
                  type="checkbox"
                  checked={settings.sedentaryReminderEnabled}
                  disabled={!settings.enabled}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      sedentaryReminderEnabled: event.target.checked,
                    })
                  }
                />
                <span className="camera-switch-track" aria-hidden />
              </label>
            </span>
          </div>

          <div data-reminder="force-lock" className="camera-reminder-row">
            <div>
              <strong>定时锁屏</strong>
              <span>开屏累计到点锁定屏幕，跟随监测时段</span>
            </div>
            <span className="sedentary-reminder-controls">
              <input
                className="sedentary-reminder-interval"
                type="number"
                inputMode="numeric"
                aria-label="定时锁屏间隔"
                aria-invalid={!validForceLockMinutes}
                min={MIN_FORCE_LOCK_MINUTES}
                max={MAX_FORCE_LOCK_MINUTES}
                step={1}
                value={forceLockMinutes}
                disabled={!settings.forceLockEnabled}
                onChange={(event) => {
                  const value = event.target.value;
                  const minutes = Number(value);
                  setForceLockMinutes(value);
                  if (
                    value !== "" &&
                    Number.isInteger(minutes) &&
                    minutes >= MIN_FORCE_LOCK_MINUTES &&
                    minutes <= MAX_FORCE_LOCK_MINUTES
                  ) {
                    onChange({
                      ...settings,
                      forceLockMinutes: minutes,
                    });
                  }
                }}
                onBlur={() =>
                  setForceLockMinutes(
                    String(settingsRef.current.forceLockMinutes),
                  )
                }
              />
              <span className="sedentary-reminder-unit">分钟</span>
              <label className="camera-switch camera-switch--small">
                <span className="sr-only">开启定时锁屏</span>
                <input
                  type="checkbox"
                  checked={settings.forceLockEnabled}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      forceLockEnabled: event.target.checked,
                    })
                  }
                />
                <span className="camera-switch-track" aria-hidden />
              </label>
            </span>
          </div>

          <div
            className={
              settings.enabled
                ? "camera-schedule-section"
                : "camera-schedule-section camera-schedule-section--disabled"
            }
          >
            <div className="camera-schedule-heading">
              <div>
                <strong>限制监测时段</strong>
                <span>关闭时全天监测与提醒</span>
              </div>
              {!scheduleExpanded && settings.scheduleEnabled && (
                <span className="camera-schedule-summary">
                  {windows
                    .map((window) => `${window.startTime}–${window.endTime}`)
                    .join("、")}
                </span>
              )}
              <label className="camera-switch camera-switch--small">
                <span className="sr-only">限制摄像头监测时段</span>
                <input
                  type="checkbox"
                  checked={settings.scheduleEnabled}
                  disabled={!settings.enabled}
                  onChange={(event) => {
                    if (event.target.checked) {
                      setScheduleExpanded(true);
                    }
                    onChange({
                      ...settings,
                      scheduleEnabled: event.target.checked,
                    });
                  }}
                />
                <span className="camera-switch-track" aria-hidden />
              </label>
              <button
                className="camera-schedule-toggle"
                type="button"
                aria-expanded={scheduleExpanded}
                aria-label={scheduleExpanded ? "收起监测时段" : "展开监测时段"}
                title={scheduleExpanded ? "收起监测时段" : "展开监测时段"}
                onClick={() => setScheduleExpanded((expanded) => !expanded)}
              >
                {scheduleExpanded ? (
                  <CaretUp size={14} weight="bold" aria-hidden />
                ) : (
                  <CaretDown size={14} weight="bold" aria-hidden />
                )}
              </button>
            </div>

            {scheduleExpanded && (
              <>
            {windows.map((window, index) => {
              const validWindow = isValidMonitoringWindow(
                window.startTime,
                window.endTime,
              );
              return (
                <div className="camera-time-entry" key={index}>
                  <div className="camera-time-row">
                    <div className="camera-time-field">
                      <span>开始</span>
                      <div
                        className={
                          scheduleControlsEnabled
                            ? "camera-time-control"
                            : "camera-time-control camera-time-control--disabled"
                        }
                      >
                        <select
                          aria-label={`时段 ${index + 1} 开始小时`}
                          value={window.startTime.slice(0, 2)}
                          disabled={!scheduleControlsEnabled}
                          onChange={(event) =>
                            updateWindow(index, {
                              startTime: `${event.target.value}:${window.startTime.slice(3)}`,
                            })
                          }
                        >
                          {HOURS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <span aria-hidden>:</span>
                        <select
                          aria-label={`时段 ${index + 1} 开始分钟`}
                          value={window.startTime.slice(3)}
                          disabled={!scheduleControlsEnabled}
                          onChange={(event) =>
                            updateWindow(index, {
                              startTime: `${window.startTime.slice(0, 2)}:${event.target.value}`,
                            })
                          }
                        >
                          {MINUTES.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <span className="camera-time-bridge" aria-hidden>
                      <Clock size={15} weight="bold" />
                      <span />
                    </span>
                    <div className="camera-time-field">
                      <span>结束</span>
                      <div
                        className={
                          scheduleControlsEnabled
                            ? "camera-time-control"
                            : "camera-time-control camera-time-control--disabled"
                        }
                      >
                        <select
                          aria-label={`时段 ${index + 1} 结束小时`}
                          value={window.endTime.slice(0, 2)}
                          disabled={!scheduleControlsEnabled}
                          onChange={(event) =>
                            updateWindow(index, {
                              endTime: `${event.target.value}:${window.endTime.slice(3)}`,
                            })
                          }
                        >
                          {HOURS.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                        <span aria-hidden>:</span>
                        <select
                          aria-label={`时段 ${index + 1} 结束分钟`}
                          value={window.endTime.slice(3)}
                          disabled={!scheduleControlsEnabled}
                          onChange={(event) =>
                            updateWindow(index, {
                              endTime: `${window.endTime.slice(0, 2)}:${event.target.value}`,
                            })
                          }
                        >
                          {MINUTES.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      className="camera-time-remove"
                      type="button"
                      aria-label={`删除时段 ${index + 1}`}
                      disabled={!scheduleControlsEnabled || windows.length <= 1}
                      onClick={() => removeWindow(index)}
                    >
                      <Trash size={14} weight="bold" aria-hidden />
                    </button>
                  </div>
                  {scheduleControlsEnabled && !validWindow && (
                    <p className="camera-time-error" role="alert">
                      结束时间需要晚于开始时间
                    </p>
                  )}
                </div>
              );
            })}
            <button
              className="camera-time-add"
              type="button"
              disabled={
                !scheduleControlsEnabled || windows.length >= MAX_MONITORING_WINDOWS
              }
              onClick={addWindow}
            >
              <Plus size={13} weight="bold" aria-hidden />
              <span>
                添加时段（{windows.length}/{MAX_MONITORING_WINDOWS}）
              </span>
            </button>
              </>
            )}
          </div>
        </section>

        <fieldset className="pet-action-settings">
          <legend className="sr-only">提醒动作</legend>
          <div className="pet-action-heading">
            <span className="pet-action-heading-mark" aria-hidden>
              <Sparkle size={14} weight="fill" />
            </span>
            <div>
              <strong>提醒动作</strong>
              <span>待机时偶尔播放 · 点击预览</span>
            </div>
          </div>
          <div className="pet-action-options">
            {PET_ACTION_OPTIONS.map(({ value, label, Icon }) => (
              <label
                className={
                  petAction === value
                    ? "pet-action-option pet-action-option--selected"
                    : "pet-action-option"
                }
                key={value}
              >
                <input
                  type="radio"
                  name="pet-action"
                  value={value}
                  checked={petAction === value}
                  onChange={() => onPetActionChange(value)}
                />
                <Icon size={15} weight={petAction === value ? "fill" : "bold"} aria-hidden />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <footer className="camera-settings-note">
        总开关在右键菜单；监测数据与动作偏好只保存在本机
      </footer>
    </article>
  );
}
