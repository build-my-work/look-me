import {
  ArrowsClockwise,
  Camera,
  Clock,
  GearSix,
  HandsClapping,
  MoonStars,
  PersonSimple,
  Prohibit,
  Shuffle,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import {
  type CameraMonitoringSettings,
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
  const [startTime, setStartTime] = useState(settings.startTime);
  const [endTime, setEndTime] = useState(settings.endTime);
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    setStartTime(settings.startTime);
    setEndTime(settings.endTime);
  }, [settings.endTime, settings.startTime]);

  const validWindow = isValidMonitoringWindow(startTime, endTime);
  const scheduleControlsEnabled = settings.enabled && settings.scheduleEnabled;

  useEffect(() => {
    if (!isValidMonitoringWindow(startTime, endTime)) {
      return;
    }
    const currentSettings = settingsRef.current;
    if (
      startTime === currentSettings.startTime &&
      endTime === currentSettings.endTime
    ) {
      return;
    }
    onChange({ ...currentSettings, startTime, endTime });
  }, [endTime, onChange, startTime]);

  return (
    <article
      className="camera-settings-panel"
      data-camera-settings
      data-interactive
      aria-labelledby="camera-settings-title"
    >
      <header className="camera-settings-header">
        <span className="camera-settings-mark" aria-hidden>
          <GearSix size={19} weight="fill" />
        </span>
        <div>
          <span className="camera-settings-eyebrow">看山陪伴</span>
          <h2 id="camera-settings-title">设置</h2>
        </div>
        <button
          className="camera-settings-close"
          type="button"
          aria-label="关闭设置"
          onClick={onClose}
        >
          <X size={15} weight="bold" aria-hidden />
        </button>
      </header>

      <div className="camera-settings-body">
        <section className="camera-monitoring-settings" aria-labelledby="monitoring-title">
          <div className="camera-settings-section-heading">
            <Camera size={12} weight="fill" aria-hidden />
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
              <label className="camera-switch camera-switch--small">
                <span className="sr-only">限制摄像头监测时段</span>
                <input
                  type="checkbox"
                  checked={settings.scheduleEnabled}
                  disabled={!settings.enabled}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      scheduleEnabled: event.target.checked,
                    })
                  }
                />
                <span className="camera-switch-track" aria-hidden />
              </label>
            </div>

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
                    aria-label="开始小时"
                    value={startTime.slice(0, 2)}
                    disabled={!scheduleControlsEnabled}
                    onChange={(event) =>
                      setStartTime(`${event.target.value}:${startTime.slice(3)}`)
                    }
                  >
                    {HOURS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <span aria-hidden>:</span>
                  <select
                    aria-label="开始分钟"
                    value={startTime.slice(3)}
                    disabled={!scheduleControlsEnabled}
                    onChange={(event) =>
                      setStartTime(`${startTime.slice(0, 2)}:${event.target.value}`)
                    }
                  >
                    {MINUTES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
              <span className="camera-time-bridge" aria-hidden>
                <Clock size={13} weight="bold" />
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
                    aria-label="结束小时"
                    value={endTime.slice(0, 2)}
                    disabled={!scheduleControlsEnabled}
                    onChange={(event) =>
                      setEndTime(`${event.target.value}:${endTime.slice(3)}`)
                    }
                  >
                    {HOURS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <span aria-hidden>:</span>
                  <select
                    aria-label="结束分钟"
                    value={endTime.slice(3)}
                    disabled={!scheduleControlsEnabled}
                    onChange={(event) =>
                      setEndTime(`${endTime.slice(0, 2)}:${event.target.value}`)
                    }
                  >
                    {MINUTES.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            {scheduleControlsEnabled && !validWindow && (
              <p className="camera-time-error" role="alert">
                结束时间需要晚于开始时间
              </p>
            )}
          </div>
        </section>

        <fieldset className="pet-action-settings">
          <legend className="sr-only">提醒动作</legend>
          <div className="pet-action-heading">
            <span className="pet-action-heading-mark" aria-hidden>
              <Sparkle size={12} weight="fill" />
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
                <Icon size={13} weight={petAction === value ? "fill" : "bold"} aria-hidden />
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
