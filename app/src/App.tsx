import {
  Camera,
  ChartLineUp,
  Eye,
  PersonSimpleWalk,
  ShieldCheck,
  SkipForward,
  X,
} from "@phosphor-icons/react";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";
import {
  type CoachMode,
  DISTANCE_DURATION_MS,
  DISTANCE_INTERVAL_MS,
  NO_BLINK_REMINDER_MS,
  coachReducer,
  createCoachState,
  getDistanceProgress,
  getDistanceSecondsRemaining,
} from "./coach";
import {
  calculateDistanceObservedMs,
  formatObservedDuration,
  getActiveScreenStartedAt,
  getBlinkTimestamps,
  summarizeTimeline,
} from "./timeline-analytics";
import { calculateBlinkStatistics } from "./blink-stats";
import {
  CAMERA_MONITORING_STORAGE_KEY,
  type CameraMonitoringSettings,
  type SystemAvailability,
  isWithinMonitoringWindow,
  parseCameraMonitoringSettings,
  shouldCameraRun,
} from "./camera-monitoring";
import { CameraSettingsPanel } from "./CameraSettingsPanel";
import {
  applyPetPersistence,
  PetAttentionController,
  type PetAttentionFrame,
} from "./pet-attention";
import {
  formatLocalDateKey,
  shiftLocalDateKey,
} from "./local-history-time";
import { useFaceMonitor } from "./useFaceMonitor";
import { isPetClick } from "./pet-pointer";
import {
  PET_IDLE_ACTION_STORAGE_KEY,
  type PetActionDemo,
  type PetIdleActionPreference,
  parsePetIdleActionPreference,
  resolvePetDisplayAction,
} from "./pet-idle-action";
import { SedentaryReminder } from "./sedentary-reminder";
import {
  TIMELINE_RETENTION_DAYS,
  getLocalDayRange,
} from "./timeline";
import { createTimelineDemoRange } from "./timeline-demo";
import { timelineRepository } from "./timeline-store";
import {
  useCurrentTimelineRange,
  useTimelineCapture,
  useTimelineRange,
} from "./useTimeline";

const PET_IMAGE = new URL("assets/kanshan-distance-break.png", document.baseURI).toString();
const CLAP_SPRITE_IMAGE = new URL("assets/kanshan-clap-sprite.png", document.baseURI).toString();
const SIT_SPRITE_IMAGE = new URL("assets/kanshan-sit-sprite.png", document.baseURI).toString();
const SPIN_SPRITE_IMAGE = new URL("assets/kanshan-spin-sprite.png", document.baseURI).toString();
const YAWN_MOUTH_IMAGE = new URL("assets/kanshan-yawn-mouth.png", document.baseURI).toString();
const TEAR_IMAGE = new URL("assets/kanshan-tear.png", document.baseURI).toString();
const HORIZON_IMAGE = new URL("assets/horizon-break.webp", document.baseURI).toString();
const PREVIEW_IMAGE = new URL("assets/preview-workspace.webp", document.baseURI).toString();
const BlinkHistoryPanel = lazy(() => import("./BlinkHistoryPanel"));
const PET_SIZE_STORAGE_KEY = "look-me:pet-size:v1";
const PET_PERSISTENCE_STORAGE_KEY = "look-me:pet-persistent:v1";
const PANEL_VISIBILITY_STORAGE_KEY = "look-me:panel-visible:v1";
const LOW_BLINK_RATE_THRESHOLD = 10;
const MOUTH_SYNC_ANIMATION_MS = 780;
const PET_SIZES = new Set<LookMePetSize>(["small", "standard", "large"]);

const DEMO_MODES = new Set<CoachMode>([
  "permission",
  "idle",
  "blink",
  "distance",
]);

function getInitialMode(
  isDesktop: boolean,
  cameraPreferenceConfigured: boolean,
): CoachMode {
  const requested = new URLSearchParams(window.location.search).get("state");
  if (requested && DEMO_MODES.has(requested as CoachMode)) {
    return requested as CoachMode;
  }
  return isDesktop
    ? cameraPreferenceConfigured
      ? "idle"
      : "permission"
    : "distance";
}

export function App() {
  const isDesktop = Boolean(window.lookMe?.isDesktop);
  const freezeDemo = new URLSearchParams(window.location.search).get("freeze") === "1";
  const statsDemo = new URLSearchParams(window.location.search).get("stats") === "1";
  const historyDemo = new URLSearchParams(window.location.search).get("history") === "1";
  const historyDataDemo =
    new URLSearchParams(window.location.search).get("historyData") === "1";
  const petBlinkDemo = new URLSearchParams(window.location.search).get("petBlink") === "1";
  const requestedPetAction =
    new URLSearchParams(window.location.search).get("petAction") ??
    (new URLSearchParams(window.location.search).get("petYawn") === "1"
      ? "yawn"
      : "");
  const petActionDemo: PetActionDemo | null = ["yawn", "clap", "sit", "spin"].includes(
    requestedPetAction,
  )
    ? (requestedPetAction as PetActionDemo)
    : null;
  const petCryDemo = new URLSearchParams(window.location.search).get("petCry") === "1";
  const cameraSettingsDemo =
    new URLSearchParams(window.location.search).get("cameraSettings") === "1";
  const sedentaryReminderDemo =
    new URLSearchParams(window.location.search).get("sedentaryReminder") === "1";
  const initialCameraPreference = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(CAMERA_MONITORING_STORAGE_KEY);
      return {
        configured: raw !== null,
        settings: parseCameraMonitoringSettings(raw),
      };
    } catch {
      return {
        configured: false,
        settings: parseCameraMonitoringSettings(null),
      };
    }
  }, []);
  const initialMode = useMemo(
    () => getInitialMode(isDesktop, initialCameraPreference.configured),
    [initialCameraPreference.configured, isDesktop],
  );
  const [state, dispatch] = useReducer(
    coachReducer,
    undefined,
    () =>
      createCoachState(
        Date.now(),
        initialMode,
        initialCameraPreference.settings.enabled ? "camera" : "timer",
      ),
  );
  const faceMonitor = useFaceMonitor();
  const lastBlinkCount = useRef(0);
  const lastYawnCount = useRef(0);
  const previousMouthOpen = useRef(false);
  const previousCoachState = useRef(state);
  const previousSedentaryReminderActive = useRef(false);
  const attentionController = useRef(new PetAttentionController());
  const sedentaryReminder = useRef(new SedentaryReminder());
  const windowDragPointer = useRef<number | null>(null);
  const windowDragStart = useRef<{ screenX: number; screenY: number } | null>(
    null,
  );
  const windowDragMoved = useRef(false);
  const [windowDragging, setWindowDragging] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );
  const [attentionFrame, setAttentionFrame] = useState<PetAttentionFrame>({
    phase: "parked",
    position: 1,
    crying: false,
    flying: false,
    rail: false,
  });
  const [statsOpen, setStatsOpen] = useState(statsDemo);
  const [sedentaryReminderActive, setSedentaryReminderActive] = useState(
    sedentaryReminderDemo,
  );
  const [cameraSettingsOpen, setCameraSettingsOpen] =
    useState(cameraSettingsDemo);
  const [cameraPreferenceConfigured, setCameraPreferenceConfigured] = useState(
    initialCameraPreference.configured,
  );
  const [cameraSettings, setCameraSettings] = useState(
    initialCameraPreference.settings,
  );
  const [systemAvailability, setSystemAvailability] =
    useState<SystemAvailability>(() =>
      isDesktop
        ? { screenLocked: true, systemSuspended: true }
        : { screenLocked: false, systemSuspended: false },
  );
  const [historyOpen, setHistoryOpen] = useState(historyDemo);
  const [petPersistent, setPetPersistent] = useState(() => {
    try {
      return window.localStorage.getItem(PET_PERSISTENCE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [panelVisible, setPanelVisible] = useState(() => {
    try {
      const stored = window.localStorage.getItem(PANEL_VISIBILITY_STORAGE_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });
  const [panelPetSide, setPanelPetSide] = useState<"left" | "right" | null>(
    null,
  );
  const [petSize, setPetSize] = useState<LookMePetSize>(() => {
    try {
      const stored = window.localStorage.getItem(PET_SIZE_STORAGE_KEY);
      return PET_SIZES.has(stored as LookMePetSize)
        ? (stored as LookMePetSize)
        : "standard";
    } catch {
      return "standard";
    }
  });
  const [petIdleAction, setPetIdleAction] = useState<PetIdleActionPreference>(() => {
    try {
      return parsePetIdleActionPreference(
        window.localStorage.getItem(PET_IDLE_ACTION_STORAGE_KEY),
      );
    } catch {
      return "auto";
    }
  });
  const [petActionPreview, setPetActionPreview] =
    useState<PetIdleActionPreference | null>(() =>
      cameraSettingsDemo ? petIdleAction : null,
    );
  const [petMouthClosing, setPetMouthClosing] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() =>
    formatLocalDateKey(Date.now()),
  );
  const applyCameraSettings = useCallback(
    (nextSettings: CameraMonitoringSettings) => {
      setCameraPreferenceConfigured(true);
      setCameraSettings(nextSettings);
      if (state.mode === "permission") {
        dispatch({
          type: "START",
          now: Date.now(),
          sensingMode: nextSettings.enabled ? "camera" : "timer",
        });
        return;
      }
      dispatch({
        type: "SET_SENSING_MODE",
        sensingMode: nextSettings.enabled ? "camera" : "timer",
      });
    },
    [state.mode],
  );
  const withinMonitoringWindow = isWithinMonitoringWindow(
    cameraSettings,
    state.now,
  );
  const cameraShouldRun = shouldCameraRun(
    cameraSettings,
    state.now,
    systemAvailability,
  );
  const coachingEnabled =
    statsDemo || historyDataDemo || !isDesktop || cameraShouldRun;
  const screenObserving =
    coachingEnabled &&
    faceMonitor.status === "ready" &&
    faceMonitor.faceVisible &&
    state.mode !== "distance";
  const screenEndReason = !coachingEnabled
    ? "monitoring-stopped"
    : state.mode === "distance"
      ? "distance-break"
      : faceMonitor.status !== "ready"
        ? "sensing-unavailable"
        : !faceMonitor.faceVisible
          ? "face-lost"
          : "not-observing";
  useTimelineCapture({
    now: state.now,
    monitoring: coachingEnabled,
    sensingReady: faceMonitor.status === "ready",
    distanceReminderEnabled: cameraSettings.distanceReminderEnabled,
    screenObserving,
    screenEndReason,
    blinkEvents: faceMonitor.blinkEvents,
    mouthEvents: faceMonitor.mouthEvents,
    yawnEvents: faceMonitor.yawnEvents,
    postureState: faceMonitor.postureState,
    postureStateSince: faceMonitor.postureStateSince,
    standUpTimestamps: faceMonitor.standUpTimestamps,
  });
  const currentTimeline = useCurrentTimelineRange();
  const distanceObservedMs = cameraSettings.distanceReminderEnabled
    ? calculateDistanceObservedMs(currentTimeline, state.now)
    : 0;
  const distanceObservedMsRef = useRef(distanceObservedMs);
  distanceObservedMsRef.current = distanceObservedMs;
  const todayDate = formatLocalDateKey(Date.now());
  const todayRange = getLocalDayRange(todayDate);
  const recordedTodayTimeline = useTimelineRange(
    todayRange.startAt,
    todayRange.endAt,
  );
  const demoTimeline = useMemo(
    () => createTimelineDemoRange(todayDate),
    [todayDate],
  );
  const displayedTodayTimeline =
    historyDemo || historyDataDemo ? demoTimeline : recordedTodayTimeline;

  useEffect(() => {
    if (cameraPreferenceConfigured) {
      try {
        window.localStorage.setItem(
          CAMERA_MONITORING_STORAGE_KEY,
          JSON.stringify(cameraSettings),
        );
      } catch {
        // Keep the monitoring preference for this session if storage is unavailable.
      }
    }
  }, [cameraPreferenceConfigured, cameraSettings]);

  useEffect(() => {
    const bridge = window.lookMe;
    if (!bridge) {
      return undefined;
    }

    let active = true;
    let receivedEvent = false;
    const stopListening = bridge.onSystemAvailability((availability) => {
      receivedEvent = true;
      setSystemAvailability(availability);
    });
    void bridge
      .getSystemAvailability()
      .then((availability) => {
        if (active && !receivedEvent) {
          setSystemAvailability(availability);
        }
      })
      .catch(() => {
        // Keep the fail-closed initial state until Electron reports availability.
      });

    return () => {
      active = false;
      stopListening();
    };
  }, []);

  useEffect(() => {
    if (!isDesktop) {
      return;
    }
    if (cameraShouldRun) {
      if (faceMonitor.status !== "error") {
        void faceMonitor.start();
      }
      return;
    }
    if (cameraSettings.enabled) {
      faceMonitor.suspend();
      return;
    }
    faceMonitor.stop();
  }, [
    cameraSettings.enabled,
    cameraShouldRun,
    faceMonitor.start,
    faceMonitor.status,
    faceMonitor.stop,
    faceMonitor.suspend,
    isDesktop,
  ]);

  useEffect(() => {
    if (freezeDemo) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      const now = Date.now();
      const nextSedentaryReminderActive =
        sedentaryReminderDemo ||
        sedentaryReminder.current.update({
          now,
          monitoring: coachingEnabled && faceMonitor.status === "ready",
          enabled: cameraSettings.sedentaryReminderEnabled,
          thresholdMs: cameraSettings.sedentaryReminderMinutes * 60 * 1_000,
          postureState: faceMonitor.postureState,
          canPrompt:
            state.mode === "idle" &&
            !cameraSettingsOpen &&
            !historyOpen &&
            !statsOpen,
        });
      setSedentaryReminderActive(nextSedentaryReminderActive);
      dispatch({
        type: "TICK",
        now,
        sensingAvailable:
          faceMonitor.status === "ready" && faceMonitor.faceVisible,
        coachingEnabled: coachingEnabled && !nextSedentaryReminderActive,
        blinkReminderEnabled: cameraSettings.blinkReminderEnabled,
        distanceReminderEnabled: cameraSettings.distanceReminderEnabled,
        distanceObservedMs: distanceObservedMsRef.current,
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [
    cameraSettings.blinkReminderEnabled,
    cameraSettings.distanceReminderEnabled,
    cameraSettings.sedentaryReminderEnabled,
    cameraSettings.sedentaryReminderMinutes,
    cameraSettingsOpen,
    coachingEnabled,
    faceMonitor.faceVisible,
    faceMonitor.postureState,
    faceMonitor.status,
    freezeDemo,
    historyOpen,
    sedentaryReminderDemo,
    state.mode,
    statsOpen,
  ]);

  useEffect(() => {
    if (faceMonitor.mouthOpen) {
      previousMouthOpen.current = true;
      setPetMouthClosing(false);
      return undefined;
    }
    if (!previousMouthOpen.current) {
      return undefined;
    }
    previousMouthOpen.current = false;
    setPetMouthClosing(true);
    const timer = window.setTimeout(
      () => setPetMouthClosing(false),
      MOUTH_SYNC_ANIMATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [faceMonitor.mouthOpen]);

  useEffect(() => {
    if (!coachingEnabled) {
      lastBlinkCount.current = faceMonitor.blinkCount;
      return;
    }
    if (faceMonitor.blinkCount < lastBlinkCount.current) {
      lastBlinkCount.current = faceMonitor.blinkCount;
      return;
    }
    const newBlinkCount = faceMonitor.blinkCount - lastBlinkCount.current;
    for (let index = 0; index < newBlinkCount; index += 1) {
      dispatch({ type: "BLINK", now: Date.now() });
    }
    lastBlinkCount.current = faceMonitor.blinkCount;
  }, [coachingEnabled, faceMonitor.blinkCount]);

  useEffect(() => {
    if (faceMonitor.yawnCount === 0) {
      lastYawnCount.current = 0;
      return undefined;
    }
    if (faceMonitor.yawnCount <= lastYawnCount.current) {
      lastYawnCount.current = faceMonitor.yawnCount;
      return undefined;
    }
    lastYawnCount.current = faceMonitor.yawnCount;
    const yawn = faceMonitor.yawnEvents[faceMonitor.yawnEvents.length - 1];
    const decision = timelineRepository.findLatestCurrentEvent("yawn.detected");
    timelineRepository.record({
      at: yawn?.at ?? Date.now(),
      layer: "action",
      type: "yawn-response.shown",
      ...(decision ? { causedBy: [decision.id] } : {}),
      data: { response: "mouth-sync" },
    });
    return undefined;
  }, [faceMonitor.yawnCount, faceMonitor.yawnEvents]);

  useEffect(() => {
    const previous = previousCoachState.current;
    if (previous.mode !== state.mode) {
      if (state.mode === "distance") {
        const decision = timelineRepository.record({
          at: state.distanceStartedAt ?? state.now,
          layer: "decision",
          type: "distance.due",
          data: {
            accumulatedScreenMs: state.distanceObservedMs,
            thresholdMs: DISTANCE_INTERVAL_MS,
          },
        });
        timelineRepository.record({
          at: state.distanceStartedAt ?? state.now,
          layer: "action",
          type: "distance-reminder.shown",
          causedBy: [decision.id],
          data: { durationMs: DISTANCE_DURATION_MS },
        });
      } else if (previous.mode === "distance") {
        const completed =
          previous.distanceStartedAt !== null &&
          state.now - previous.distanceStartedAt >= DISTANCE_DURATION_MS;
        const skipped = timelineRepository.findLatestCurrentEvent(
          "distance-reminder.skipped",
        );
        if (completed) {
          timelineRepository.record({
            at: state.now,
            layer: "action",
            type: "distance-reminder.completed",
          });
        } else if (
          !skipped ||
          previous.distanceStartedAt === null ||
          skipped.at < previous.distanceStartedAt
        ) {
          timelineRepository.record({
            at: state.now,
            layer: "action",
            type: "distance-reminder.dismissed",
            data: {
              reason: cameraSettings.distanceReminderEnabled
                ? "monitoring-unavailable"
                : "reminder-disabled",
            },
          });
        }
      }

      if (state.mode === "blink") {
        const decision = timelineRepository.record({
          at: state.now,
          layer: "decision",
          type: "blink-reminder.due",
          data: { thresholdMs: NO_BLINK_REMINDER_MS },
        });
        timelineRepository.record({
          at: state.now,
          layer: "action",
          type: "blink-reminder.shown",
          causedBy: [decision.id],
        });
      } else if (previous.mode === "blink") {
        timelineRepository.record({
          at: state.now,
          layer: "action",
          type:
            state.guidedBlinks >= 2
              ? "blink-reminder.completed"
              : "blink-reminder.dismissed",
          data:
            state.guidedBlinks >= 2
              ? { blinkCount: state.guidedBlinks }
              : { reason: "sensing-or-setting-changed" },
        });
      }
    }
    previousCoachState.current = state;
  }, [cameraSettings.distanceReminderEnabled, state]);

  useEffect(() => {
    const previous = previousSedentaryReminderActive.current;
    if (!previous && sedentaryReminderActive) {
      const decision = timelineRepository.record({
        at: state.now,
        layer: "decision",
        type: "sedentary.due",
        data: {
          thresholdMs: cameraSettings.sedentaryReminderMinutes * 60 * 1_000,
        },
      });
      timelineRepository.record({
        at: state.now,
        layer: "action",
        type: "sedentary-reminder.shown",
        causedBy: [decision.id],
      });
    } else if (previous && !sedentaryReminderActive) {
      const acknowledged = timelineRepository.findLatestCurrentEvent(
        "sedentary-reminder.acknowledged",
      );
      if (!acknowledged || state.now - acknowledged.at > 1_000) {
        timelineRepository.record({
          at: state.now,
          layer: "action",
          type: "sedentary-reminder.dismissed",
        });
      }
    }
    previousSedentaryReminderActive.current = sedentaryReminderActive;
  }, [
    cameraSettings.sedentaryReminderMinutes,
    sedentaryReminderActive,
    state.now,
  ]);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) {
      return undefined;
    }
    const updateReducedMotion = () => setReducedMotion(media.matches);
    media.addEventListener("change", updateReducedMotion);
    return () => media.removeEventListener("change", updateReducedMotion);
  }, []);

  useEffect(() => {
    const updateAttention = () => {
      const frame = attentionController.current.update({
        now: Date.now(),
        sensing:
          coachingEnabled &&
          cameraSettings.blinkReminderEnabled &&
          faceMonitor.status === "ready" &&
          faceMonitor.faceVisible,
        parked:
          state.mode !== "idle" ||
          sedentaryReminderActive ||
          cameraSettingsOpen ||
          statsOpen ||
          historyOpen,
        held: windowDragging,
        blinkCount: faceMonitor.blinkCount,
        reducedMotion,
      });
      setAttentionFrame((current) =>
        current.phase === frame.phase &&
        current.crying === frame.crying &&
        current.flying === frame.flying &&
        current.rail === frame.rail &&
        Math.abs(current.position - frame.position) < 0.001
          ? current
          : frame,
      );
    };

    updateAttention();
    const timer = window.setInterval(updateAttention, 50);
    return () => window.clearInterval(timer);
  }, [
    faceMonitor.blinkCount,
    faceMonitor.faceVisible,
    faceMonitor.status,
    cameraSettingsOpen,
    cameraSettings.blinkReminderEnabled,
    coachingEnabled,
    historyOpen,
    reducedMotion,
    sedentaryReminderActive,
    state.mode,
    statsOpen,
    windowDragging,
  ]);

  useEffect(() => {
    window.lookMe?.syncPetAttention({
      phase: attentionFrame.phase,
      position: attentionFrame.position,
      rail: attentionFrame.rail,
    });
  }, [attentionFrame.phase, attentionFrame.position, attentionFrame.rail]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PET_SIZE_STORAGE_KEY, petSize);
    } catch {
      // Keep the selected size for this session if local storage is unavailable.
    }
    window.lookMe?.syncPetSize(petSize);
  }, [petSize]);

  useEffect(() => {
    try {
      window.localStorage.setItem(PET_IDLE_ACTION_STORAGE_KEY, petIdleAction);
    } catch {
      // Keep the selected action for this session if local storage is unavailable.
    }
  }, [petIdleAction]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PET_PERSISTENCE_STORAGE_KEY,
        String(petPersistent),
      );
    } catch {
      // Keep the selected visibility for this session if local storage is unavailable.
    }
    window.lookMe?.syncPetPersistence(petPersistent);
  }, [petPersistent]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PANEL_VISIBILITY_STORAGE_KEY,
        String(panelVisible),
      );
    } catch {
      // Keep the selected visibility for this session if local storage is unavailable.
    }
    window.lookMe?.syncPanelVisibility(panelVisible);
  }, [panelVisible]);

  useEffect(() => {
    const bridge = window.lookMe;
    if (!bridge) {
      return undefined;
    }

    const updatePointerEvents = (event: MouseEvent) => {
      if (windowDragPointer.current !== null) {
        bridge.setPointerEvents(true);
        return;
      }
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const overDragRegion = Boolean(target?.closest("[data-window-drag]"));
      bridge.setPointerEvents(
        overDragRegion || Boolean(target?.closest("[data-interactive]")),
      );
    };
    bridge.setPointerEvents(false);
    window.addEventListener("mousemove", updatePointerEvents);
    return () => {
      window.removeEventListener("mousemove", updatePointerEvents);
      bridge.setPointerEvents(false);
    };
  }, []);

  useEffect(() => {
    return window.lookMe?.onCommand((command) => {
      if (command.startsWith("pet-size:")) {
        const requestedSize = command.slice("pet-size:".length) as LookMePetSize;
        if (PET_SIZES.has(requestedSize)) {
          setPetSize(requestedSize);
        }
        return;
      }
      if (command === "pet-persistent:on" || command === "pet-persistent:off") {
        const enabled = command === "pet-persistent:on";
        setPetPersistent(enabled);
        return;
      }
      if (command === "panel:hide") {
        setPanelVisible(false);
        setPanelPetSide(null);
        return;
      }
      if (command.startsWith("panel:show")) {
        const requestedSide = command.slice("panel:show:".length);
        setPanelPetSide(
          requestedSide === "left" || requestedSide === "right"
            ? requestedSide
            : null,
        );
        setPanelVisible(true);
        return;
      }
      if (command === "monitoring:on" || command === "monitoring:off") {
        applyCameraSettings({
          ...cameraSettings,
          enabled: command === "monitoring:on",
        });
        return;
      }
      if (command === "camera-settings:show") {
        setHistoryOpen(false);
        setStatsOpen(false);
        setPetActionPreview(petIdleAction);
        setCameraSettingsOpen(true);
      }
    });
  }, [applyCameraSettings, cameraSettings, petIdleAction]);

  useEffect(() => {
    window.lookMe?.syncMonitoringEnabled(cameraSettings.enabled);
  }, [cameraSettings.enabled]);

  useEffect(() => {
    window.lookMe?.syncCameraSettingsOpen(cameraSettingsOpen);
  }, [cameraSettingsOpen]);

  useEffect(() => {
    window.lookMe?.syncHistoryOpen(historyOpen);
  }, [historyOpen]);

  const enableCamera = () => {
    applyCameraSettings({ ...cameraSettings, enabled: true });
  };

  const disableMonitoring = () => {
    applyCameraSettings({ ...cameraSettings, enabled: false });
  };

  const endWindowDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (windowDragPointer.current !== event.pointerId) {
      return;
    }
    windowDragPointer.current = null;
    windowDragStart.current = null;
    windowDragMoved.current = false;
    setWindowDragging(false);
    window.lookMe?.dragWindow("end", event.screenX, event.screenY);
  };

  const secondsRemaining = getDistanceSecondsRemaining(state);
  const distanceProgress = getDistanceProgress(state);
  const firstHistoryDate = shiftLocalDateKey(
    todayDate,
    -(TIMELINE_RETENTION_DAYS - 1),
  );
  const activeScreenStartedAt = getActiveScreenStartedAt(currentTimeline);
  const timelineBlinkTimestamps = getBlinkTimestamps(currentTimeline);
  const measuredStats = calculateBlinkStatistics(
    timelineBlinkTimestamps,
    faceMonitor.sessionStartedAt,
    activeScreenStartedAt,
    state.now,
  );
  const blinkStats = statsDemo
    ? {
        rollingRate: 14,
        segmentAverage: 16,
        recentCount: 14,
        totalCount: 38,
        collectingSecondsRemaining: 0,
      }
    : measuredStats;
  const measuredTodaySummary = summarizeTimeline(
    displayedTodayTimeline,
    todayRange.startAt,
    todayRange.endAt,
    state.now,
  );
  const todayObservedDuration = formatObservedDuration(
    measuredTodaySummary.screenMs,
  );
  const todayPostureSummary = statsDemo
    ? { seatedMs: 4 * 60 * 60_000 + 32 * 60_000, awayMs: 38 * 60_000, standUps: 4 }
    : measuredTodaySummary;
  const currentSeatedDuration = statsDemo
    ? formatObservedDuration(42 * 60_000)
    : faceMonitor.postureState === "seated" &&
        faceMonitor.postureStateSince !== null
      ? formatObservedDuration(
          Math.max(0, state.now - faceMonitor.postureStateSince),
        )
      : null;
  const todaySeatedDuration = formatObservedDuration(todayPostureSummary.seatedMs);
  const todayAwayDuration = formatObservedDuration(todayPostureSummary.awayMs);
  const hasCameraSession = statsDemo || faceMonitor.sessionStartedAt !== null;
  const hasVisibleFace =
    statsDemo ||
    (coachingEnabled && faceMonitor.status === "ready" && faceMonitor.faceVisible);
  let cameraStatus: {
    label: string;
    tone: "active" | "waiting" | "off" | "error";
  };
  if (!cameraSettings.enabled) {
    cameraStatus = { label: "监测与提醒已关闭", tone: "off" };
  } else if (systemAvailability.systemSuspended) {
    cameraStatus = { label: "系统睡眠时已关闭", tone: "waiting" };
  } else if (systemAvailability.screenLocked) {
    cameraStatus = { label: "锁屏时已关闭", tone: "waiting" };
  } else if (cameraSettings.scheduleEnabled && !withinMonitoringWindow) {
    cameraStatus = {
      label: `时段外 · ${cameraSettings.startTime} 恢复`,
      tone: "waiting",
    };
  } else if (faceMonitor.status === "error") {
    cameraStatus = {
      label: faceMonitor.errorMessage ?? "摄像头暂时无法启动",
      tone: "error",
    };
  } else if (faceMonitor.status === "starting") {
    cameraStatus = { label: "正在准备本地检测", tone: "waiting" };
  } else if (faceMonitor.status === "ready" && !faceMonitor.faceVisible) {
    cameraStatus = {
      label: cameraSettings.blinkReminderEnabled
        ? "暂未检测到人脸，眨眼提醒已暂停"
        : "暂未检测到人脸",
      tone: "waiting",
    };
  } else if (faceMonitor.status === "ready") {
    cameraStatus = { label: "本地检测中", tone: "active" };
  } else {
    cameraStatus = { label: "等待恢复本地检测", tone: "waiting" };
  }
  const sensingLabel =
    statsDemo || (faceMonitor.status === "ready" && faceMonitor.faceVisible)
      ? "本地检测中"
      : !cameraSettings.enabled
        ? "监测与提醒已关闭"
        : faceMonitor.status === "ready"
          ? cameraSettings.blinkReminderEnabled
            ? "暂未检测到人脸，眨眼提醒已暂停"
            : "暂未检测到人脸"
          : cameraStatus.label;
  const postureStatusLabel = statsDemo
    ? "坐姿位置已建立"
    : !coachingEnabled || faceMonitor.status !== "ready"
      ? cameraStatus.label
      : faceMonitor.postureState === "calibrating"
        ? "正在建立坐姿位置"
        : faceMonitor.postureState === "seated"
          ? "坐姿监测中"
          : faceMonitor.postureState === "away"
            ? "已识别向上离座"
            : "暂时无法判断离座方向";
  const persistentAttentionFrame = applyPetPersistence(
    attentionFrame,
    petPersistent,
  );
  const displayedAttentionFrame: PetAttentionFrame = petCryDemo
    ? {
        phase: "crying",
        position: 1,
        crying: true,
        flying: false,
        rail: true,
      }
    : persistentAttentionFrame;
  const standardCoachVisible =
    !cameraSettingsOpen && !historyOpen && !sedentaryReminderActive;
  const companionVisible = standardCoachVisible && panelVisible;
  const petDisplayAction = resolvePetDisplayAction({
    petActionDemo,
    mouthOpen: faceMonitor.mouthOpen,
    mouthClosing: petMouthClosing,
    cameraSettingsOpen,
    petActionPreview,
    idleActionEligible:
      state.mode === "idle" &&
      !sedentaryReminderActive &&
      !cameraSettingsOpen &&
      !historyOpen &&
      !statsOpen,
    petIdleAction,
  });

  return (
    <main
      className={
        isDesktop
          ? `app-shell app-shell--desktop${cameraSettingsOpen ? " app-shell--settings" : ""}${historyOpen ? " app-shell--history" : ""}`
          : "app-shell app-shell--preview"
      }
      style={isDesktop ? undefined : { backgroundImage: `url(${PREVIEW_IMAGE})` }}
      data-mode={sedentaryReminderActive ? "sedentary" : state.mode}
      data-pet-attention={displayedAttentionFrame.phase}
    >
      <video ref={faceMonitor.videoRef} className="sensor-video" muted playsInline />

      <section
        className="coach-stage"
        data-pet-size={petSize}
        data-camera-settings-open={cameraSettingsOpen ? "true" : undefined}
        data-history-open={historyOpen ? "true" : undefined}
        data-pet-attention={displayedAttentionFrame.phase}
        data-pet-rail={displayedAttentionFrame.rail ? "true" : "false"}
        data-pet-flying={displayedAttentionFrame.flying ? "true" : "false"}
        data-pet-panel-side={panelVisible ? panelPetSide ?? undefined : undefined}
        data-pet-action-preference={petIdleAction}
        data-pet-idle-action={petDisplayAction}
        aria-label="Look Me 护眼陪伴"
      >
        <div className="coach-pet-shell">
          <div className="coach-pet-visual">
            <img className="coach-pet" src={PET_IMAGE} alt="刘看山护眼小伙伴" />
            <span
              className="pet-sprite pet-sprite--clap"
              style={{ backgroundImage: `url(${CLAP_SPRITE_IMAGE})` }}
              aria-hidden="true"
            />
            <span
              className="pet-sprite pet-sprite--sit"
              style={{ backgroundImage: `url(${SIT_SPRITE_IMAGE})` }}
              aria-hidden="true"
            />
            <span
              className="pet-sprite pet-sprite--spin"
              style={{ backgroundImage: `url(${SPIN_SPRITE_IMAGE})` }}
              aria-hidden="true"
            />
            <img className="pet-yawn-mouth" src={YAWN_MOUTH_IMAGE} alt="" />
            <span className="pet-yawn-eyelid" aria-hidden="true" />
            {(faceMonitor.blinkCount > 0 || petBlinkDemo) && (
              <span
                className={petBlinkDemo ? "pet-eyelid pet-eyelid--demo" : "pet-eyelid"}
                key={petBlinkDemo ? "demo" : faceMonitor.blinkCount}
                aria-hidden="true"
              />
            )}
          </div>
          {displayedAttentionFrame.crying && (
            <>
              <img className="pet-tear pet-tear--stream" src={TEAR_IMAGE} alt="" />
              <img className="pet-tear pet-tear--drop" src={TEAR_IMAGE} alt="" />
            </>
          )}
        </div>
        {isDesktop && (
          <div
            className="window-drag-region"
            data-window-drag
            title="右键看山打开设置，按住左键拖动"
            aria-hidden="true"
            onContextMenu={(event) => {
              event.preventDefault();
              window.lookMe?.openSettings();
            }}
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              windowDragPointer.current = event.pointerId;
              windowDragStart.current = {
                screenX: event.screenX,
                screenY: event.screenY,
              };
              windowDragMoved.current = false;
              setWindowDragging(true);
              event.currentTarget.setPointerCapture(event.pointerId);
              const bounds = event.currentTarget.getBoundingClientRect();
              window.lookMe?.dragWindow("start", event.screenX, event.screenY, {
                x: bounds.x,
                y: bounds.y,
                width: bounds.width,
                height: bounds.height,
              });
            }}
            onPointerMove={(event) => {
              if (windowDragPointer.current === event.pointerId) {
                const startedAt = windowDragStart.current;
                if (
                  !windowDragMoved.current &&
                  startedAt &&
                  !isPetClick(startedAt, {
                    screenX: event.screenX,
                    screenY: event.screenY,
                  })
                ) {
                  windowDragMoved.current = true;
                }
                if (windowDragMoved.current) {
                  window.lookMe?.dragWindow("move", event.screenX, event.screenY);
                }
              }
            }}
            onPointerUp={endWindowDrag}
            onPointerCancel={endWindowDrag}
            onLostPointerCapture={endWindowDrag}
          />
        )}

        {cameraSettingsOpen && (
          <CameraSettingsPanel
            settings={cameraSettings}
            statusLabel={cameraStatus.label}
            statusTone={cameraStatus.tone}
            petAction={petIdleAction}
            onChange={applyCameraSettings}
            onPetActionChange={(action) => {
              setPetIdleAction(action);
              setPetActionPreview(action);
            }}
            onClose={() => {
              setCameraSettingsOpen(false);
              setPetActionPreview(null);
            }}
          />
        )}

        {!cameraSettingsOpen && historyOpen && (
          <Suspense fallback={null}>
            <BlinkHistoryPanel
              selectedDate={selectedHistoryDate}
              firstDate={firstHistoryDate}
              todayDate={todayDate}
              now={state.now}
              demoRange={
                (historyDemo || historyDataDemo) && selectedHistoryDate === todayDate
                  ? demoTimeline
                  : undefined
              }
              onSelectDate={setSelectedHistoryDate}
              onClose={() => setHistoryOpen(false)}
            />
          </Suspense>
        )}

        {!cameraSettingsOpen && !historyOpen && sedentaryReminderActive && (
          <article
            className="coach-card coach-card--sedentary"
            data-interactive
            data-sedentary-reminder
            aria-live="polite"
          >
            <div className="card-icon card-icon--posture">
              <PersonSimpleWalk size={25} weight="fill" aria-hidden />
            </div>
            <div className="sedentary-copy">
              <span className="eyebrow">坐得有点久啦</span>
              <h1>起来走一走吧</h1>
              <p>离开座位后，会重新开始计算连续坐姿时间。</p>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  timelineRepository.record({
                    at: Date.now(),
                    layer: "action",
                    type: "sedentary-reminder.acknowledged",
                  });
                  sedentaryReminder.current.acknowledge();
                  setSedentaryReminderActive(false);
                }}
              >
                知道了
              </button>
            </div>
          </article>
        )}

        {standardCoachVisible && state.mode === "distance" && (
          <article
            className="coach-card coach-card--horizon"
            style={{ backgroundImage: `url(${HORIZON_IMAGE})` }}
            aria-live="polite"
          >
            <div className="horizon-copy">
              <p className="horizon-prompt">
                看看远处，休息 <strong>{secondsRemaining}</strong> 秒
              </p>
            </div>

            <div className="distance-progress" aria-label={`剩余 ${secondsRemaining} 秒`}>
              <CircularProgressbar
                value={100 - distanceProgress}
                text={`${secondsRemaining}`}
                strokeWidth={7}
                styles={buildStyles({
                  pathColor: "rgba(255, 255, 255, 0.96)",
                  trailColor: "rgba(255, 255, 255, 0.3)",
                  textColor: "#ffffff",
                  pathTransitionDuration: 0.25,
                  strokeLinecap: "round",
                })}
              />
              <span>秒</span>
            </div>
            <button
              className="text-button"
              data-interactive
              type="button"
              onClick={() => {
                const now = Date.now();
                timelineRepository.record({
                  at: now,
                  layer: "action",
                  type: "distance-reminder.skipped",
                  data: { accumulatedScreenMs: state.distanceObservedMs },
                });
                dispatch({ type: "SKIP", now });
              }}
            >
              <SkipForward size={16} weight="bold" aria-hidden />
              跳过
            </button>
          </article>
        )}

        {!cameraSettingsOpen && !historyOpen && state.mode === "permission" && (
          <article className="coach-card coach-card--permission" data-interactive>
            <div className="card-icon card-icon--camera">
              <Camera size={24} weight="fill" aria-hidden />
            </div>
            <div className="permission-copy">
              <span className="eyebrow">第一次见面</span>
              <h1>让我在本机陪你眨眨眼</h1>
              <p>
                摄像头画面只在设备上即时处理，不上传、不保存。它不是医疗诊断工具。
              </p>
              {faceMonitor.errorMessage && (
                <p className="inline-error" role="alert">{faceMonitor.errorMessage}</p>
              )}
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  onClick={enableCamera}
                  disabled={faceMonitor.status === "starting"}
                >
                  <Camera size={17} weight="bold" aria-hidden />
                  {faceMonitor.status === "starting" ? "正在准备…" : "开启本地检测"}
                </button>
                <button className="secondary-button" type="button" onClick={disableMonitoring}>
                  <X size={17} weight="bold" aria-hidden />
                  暂不开启
                </button>
              </div>
              <div className="permission-meta">
                <span className="privacy-note">
                  <ShieldCheck size={14} weight="fill" aria-hidden />
                  可随时在右键菜单中关闭
                </span>
                <button
                  className="history-link"
                  type="button"
                  onClick={() => {
                    setSelectedHistoryDate(todayDate);
                    setHistoryOpen(true);
                  }}
                >
                  <ChartLineUp size={14} weight="bold" aria-hidden />
                  查看历史曲线
                </button>
              </div>
            </div>
          </article>
        )}

        {standardCoachVisible && state.mode === "blink" && (
          <article className="coach-card coach-card--blink" aria-live="polite">
            <div className="card-icon card-icon--eye">
              <Eye size={25} weight="fill" aria-hidden />
            </div>
            <div className="blink-copy">
              <span className="eyebrow">眼睛有点忙啦</span>
              <h1>陪我慢慢眨 2 下</h1>
              <div className="blink-dots" aria-label={`已完成 ${state.guidedBlinks}/2 下`}>
                {[0, 1].map((index) => (
                  <span
                    className={index < state.guidedBlinks ? "blink-dot blink-dot--done" : "blink-dot"}
                    key={index}
                  />
                ))}
              </div>
            </div>
          </article>
        )}

        {standardCoachVisible && state.mode === "idle" && (
          <>
            {statsOpen && (
              <article
                className="stats-panel"
                data-interactive
                aria-label="眨眼、看屏与离座统计"
              >
                <header className="stats-header">
                  <span className="stats-mark" aria-hidden>
                    <ChartLineUp size={19} weight="bold" />
                  </span>
                  <div>
                    <h2>眨眼、看屏与离座</h2>
                    <p>
                      {hasCameraSession
                        ? postureStatusLabel
                        : "需要开启本地检测"}
                    </p>
                  </div>
                  <button
                    className="stats-close"
                    type="button"
                    aria-label="收起统计"
                    onClick={() => setStatsOpen(false)}
                  >
                    <X size={15} weight="bold" aria-hidden />
                  </button>
                </header>

                {hasCameraSession ? (
                  <dl className="stats-metrics">
                    <div>
                      <dt>近 1 分钟估算</dt>
                      <dd>
                        <strong>{hasVisibleFace ? (blinkStats.rollingRate ?? "—") : "—"}</strong>
                        <span>次/分</span>
                      </dd>
                    </div>
                    <div>
                      <dt>当前段平均</dt>
                      <dd>
                        <strong>{hasVisibleFace ? (blinkStats.segmentAverage ?? "—") : "—"}</strong>
                        <span>次/分</span>
                      </dd>
                    </div>
                    <div>
                      <dt>本次总计</dt>
                      <dd>
                        <strong>{blinkStats.totalCount}</strong>
                        <span>次</span>
                      </dd>
                    </div>
                    <div>
                      <dt>今日有效看屏</dt>
                      <dd>
                        <strong>{todayObservedDuration.value}</strong>
                        <span>{todayObservedDuration.unit}</span>
                      </dd>
                    </div>
                  </dl>
                ) : (
                  <p className="stats-empty">
                    点击「开启本地检测」后，频率会在这里出现。
                  </p>
                )}
                {hasCameraSession && (
                  <dl className="stats-metrics stats-metrics--posture">
                    <div>
                      <dt>连续坐姿</dt>
                      <dd>
                        <strong>{currentSeatedDuration?.value ?? "—"}</strong>
                        <span>{currentSeatedDuration?.unit ?? ""}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>今日坐姿</dt>
                      <dd>
                        <strong>{todaySeatedDuration.value}</strong>
                        <span>{todaySeatedDuration.unit}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>今日离座</dt>
                      <dd>
                        <strong>{todayAwayDuration.value}</strong>
                        <span>{todayAwayDuration.unit}</span>
                      </dd>
                    </div>
                    <div>
                      <dt>今日起身</dt>
                      <dd>
                        <strong>{todayPostureSummary.standUps}</strong>
                        <span>次</span>
                      </dd>
                    </div>
                  </dl>
                )}
                <div className="stats-footer">
                  <p className="stats-footnote">
                    坐姿按脸部位置估算；离座不等于精确站立
                  </p>
                  <button
                    className="stats-history-button"
                    type="button"
                    onClick={() => {
                      setSelectedHistoryDate(todayDate);
                      setHistoryOpen(true);
                    }}
                  >
                    查看近 1 小时曲线
                  </button>
                </div>
              </article>
            )}

          </>
        )}

        {companionVisible && (
          <article className="idle-companion" data-interactive>
            <div className="idle-status" title={sensingLabel}>
              <span className="stats-eye-pulse" key={faceMonitor.blinkCount} aria-hidden>
                <Eye size={14} weight="fill" />
              </span>
              <span
                className={
                  hasVisibleFace &&
                  blinkStats.rollingRate !== null &&
                  blinkStats.rollingRate < LOW_BLINK_RATE_THRESHOLD
                    ? "idle-status-value idle-status-value--low"
                    : "idle-status-value"
                }
              >
                {hasVisibleFace
                  ? blinkStats.rollingRate === null
                    ? `采集中 ${blinkStats.collectingSecondsRemaining} 秒`
                    : `${blinkStats.rollingRate} 次/分`
                  : sensingLabel}
              </span>
            </div>
            <div className="idle-actions">
              <button
                className={statsOpen ? "icon-button icon-button--active" : "icon-button"}
                type="button"
                title="查看统计"
                aria-label="查看统计"
                aria-expanded={statsOpen}
                onClick={() => setStatsOpen((open) => !open)}
              >
                <ChartLineUp size={18} weight="bold" aria-hidden />
              </button>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
