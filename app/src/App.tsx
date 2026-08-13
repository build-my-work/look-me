import {
  Camera,
  ChartLineUp,
  Eye,
  Moon,
  Pause,
  Play,
  ShieldCheck,
  SkipForward,
  Timer,
  X,
} from "@phosphor-icons/react";
import {
  Suspense,
  lazy,
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
  coachReducer,
  createCoachState,
  getDistanceProgress,
  getDistanceSecondsRemaining,
} from "./coach";
import {
  BLINK_HISTORY_RETENTION_DAYS,
  type BlinkHistory,
  formatLocalDateKey,
  formatObservedDuration,
  shiftLocalDateKey,
  summarizeDay,
} from "./blink-history";
import { calculateBlinkStatistics } from "./blink-stats";
import {
  applyPetPersistence,
  PetAttentionController,
  type PetAttentionFrame,
} from "./pet-attention";
import { useBlinkDetector } from "./useBlinkDetector";
import { useBlinkHistory } from "./useBlinkHistory";

const PET_IMAGE = new URL("assets/kanshan-distance-break.png", document.baseURI).toString();
const TEAR_IMAGE = new URL("assets/kanshan-tear.png", document.baseURI).toString();
const HORIZON_IMAGE = new URL("assets/horizon-break.webp", document.baseURI).toString();
const PREVIEW_IMAGE = new URL("assets/preview-workspace.webp", document.baseURI).toString();
const BlinkHistoryPanel = lazy(() => import("./BlinkHistoryPanel"));
const PET_SIZE_STORAGE_KEY = "look-me:pet-size:v1";
const PET_PERSISTENCE_STORAGE_KEY = "look-me:pet-persistent:v1";
const HISTORY_VISIBILITY_STORAGE_KEY = "look-me:history-visible:v1";
const PET_SIZES = new Set<LookMePetSize>(["small", "standard", "large"]);

const DEMO_MODES = new Set<CoachMode>([
  "permission",
  "idle",
  "blink",
  "distance",
  "paused",
]);

function getInitialMode(isDesktop: boolean): CoachMode {
  const requested = new URLSearchParams(window.location.search).get("state");
  if (requested && DEMO_MODES.has(requested as CoachMode)) {
    return requested as CoachMode;
  }
  return isDesktop ? "permission" : "distance";
}

export function App() {
  const isDesktop = Boolean(window.lookMe?.isDesktop);
  const freezeDemo = new URLSearchParams(window.location.search).get("freeze") === "1";
  const statsDemo = new URLSearchParams(window.location.search).get("stats") === "1";
  const historyDemo = new URLSearchParams(window.location.search).get("history") === "1";
  const historyDataDemo =
    new URLSearchParams(window.location.search).get("historyData") === "1";
  const petBlinkDemo = new URLSearchParams(window.location.search).get("petBlink") === "1";
  const petCryDemo = new URLSearchParams(window.location.search).get("petCry") === "1";
  const initialMode = useMemo(() => getInitialMode(isDesktop), [isDesktop]);
  const [state, dispatch] = useReducer(
    coachReducer,
    undefined,
    () => createCoachState(Date.now(), initialMode),
  );
  const detector = useBlinkDetector();
  const lastBlinkCount = useRef(0);
  const attentionController = useRef(new PetAttentionController());
  const windowDragPointer = useRef<number | null>(null);
  const [windowDragging, setWindowDragging] = useState(false);
  const [manualRevealUntil, setManualRevealUntil] = useState(0);
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
  const [historyOpen, setHistoryOpen] = useState(() => {
    if (historyDemo) {
      return true;
    }
    try {
      return window.localStorage.getItem(HISTORY_VISIBILITY_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
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
  const [petPersistent, setPetPersistent] = useState(() => {
    try {
      return window.localStorage.getItem(PET_PERSISTENCE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(() =>
    formatLocalDateKey(Date.now()),
  );
  const [visibleSince, setVisibleSince] = useState<number | null>(() =>
    statsDemo ? Date.now() - 60_000 : null,
  );

  useEffect(() => {
    if (freezeDemo) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      dispatch({
        type: "TICK",
        now: Date.now(),
        sensingAvailable:
          detector.status === "ready" && detector.faceVisible,
      });
    }, 250);
    return () => window.clearInterval(timer);
  }, [detector.faceVisible, detector.status, freezeDemo]);

  useEffect(() => {
    if (detector.blinkCount < lastBlinkCount.current) {
      lastBlinkCount.current = detector.blinkCount;
      return;
    }
    const newBlinkCount = detector.blinkCount - lastBlinkCount.current;
    for (let index = 0; index < newBlinkCount; index += 1) {
      dispatch({ type: "BLINK", now: Date.now() });
    }
    lastBlinkCount.current = detector.blinkCount;
  }, [detector.blinkCount]);

  useEffect(() => {
    if (statsDemo) {
      return;
    }
    if (detector.status === "ready" && detector.faceVisible) {
      setVisibleSince((startedAt) => startedAt ?? Date.now());
      return;
    }
    setVisibleSince(null);
  }, [detector.faceVisible, detector.status, statsDemo]);

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
        sensing: detector.status === "ready" && detector.faceVisible,
        parked:
          state.mode !== "idle" ||
          statsOpen ||
          historyOpen ||
          Date.now() < manualRevealUntil,
        held: windowDragging,
        blinkCount: detector.blinkCount,
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
    detector.blinkCount,
    detector.faceVisible,
    detector.status,
    historyOpen,
    manualRevealUntil,
    reducedMotion,
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
    if (historyDemo) {
      return;
    }
    try {
      window.localStorage.setItem(
        HISTORY_VISIBILITY_STORAGE_KEY,
        String(historyOpen),
      );
    } catch {
      // Keep the selected visibility for this session if local storage is unavailable.
    }
    window.lookMe?.syncHistoryVisibility(historyOpen);
  }, [historyDemo, historyOpen]);

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
        setPetPersistent(command === "pet-persistent:on");
        return;
      }
      if (command === "history:show" || command === "history:hide") {
        setHistoryOpen(command === "history:show");
        return;
      }
      if (command === "attention:reveal") {
        setManualRevealUntil(Date.now() + 15_000);
        return;
      }
      dispatch({
        type: command === "pause" ? "PAUSE" : "START_DISTANCE",
        now: Date.now(),
      });
    });
  }, []);

  const enableCamera = async () => {
    const started = await detector.start();
    if (started) {
      dispatch({ type: "START", now: Date.now(), sensingMode: "camera" });
    }
  };

  const useTimerOnly = () => {
    detector.stop();
    dispatch({ type: "START", now: Date.now(), sensingMode: "timer" });
  };

  const endWindowDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (windowDragPointer.current !== event.pointerId) {
      return;
    }
    windowDragPointer.current = null;
    setWindowDragging(false);
    window.lookMe?.dragWindow("end", event.screenX, event.screenY);
  };

  const secondsRemaining = getDistanceSecondsRemaining(state);
  const distanceProgress = getDistanceProgress(state);
  const history = useBlinkHistory(
    detector.blinkTimestamps,
    detector.status === "ready" &&
      detector.faceVisible &&
      state.mode !== "paused" &&
      state.mode !== "distance",
    state.now,
  );
  const todayDate = formatLocalDateKey(Date.now());
  const firstHistoryDate = shiftLocalDateKey(
    todayDate,
    -(BLINK_HISTORY_RETENTION_DAYS - 1),
  );
  const displayedHistory = useMemo<BlinkHistory>(() => {
    if (!historyDemo && !historyDataDemo) {
      return history;
    }

    const demoDay: BlinkHistory["days"][string] = {};
    for (let minute = 8 * 60 + 30; minute < 18 * 60 + 20; minute += 1) {
      const duringLunch = minute >= 12 * 60 && minute < 13 * 60 + 20;
      const sensingGap = minute % 97 >= 89;
      if (duringLunch || sensingGap) {
        continue;
      }
      demoDay[String(minute)] = {
        blinks: Math.max(
          5,
          Math.round(13 + Math.sin(minute / 24) * 3 + Math.cos(minute / 11) * 2),
        ),
        observedMs: 60_000,
      };
    }
    return {
      version: 1,
      days: { ...history.days, [todayDate]: demoDay },
    };
  }, [history, historyDataDemo, historyDemo, todayDate]);
  const measuredStats = calculateBlinkStatistics(
    detector.blinkTimestamps,
    detector.sessionStartedAt,
    visibleSince,
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
  const todayObservedDuration = formatObservedDuration(
    summarizeDay(displayedHistory, todayDate).observedMs,
  );
  const hasCameraSession = statsDemo || detector.sessionStartedAt !== null;
  const hasVisibleFace =
    statsDemo || (detector.status === "ready" && detector.faceVisible);
  const sensingLabel =
    statsDemo || (detector.status === "ready" && detector.faceVisible)
      ? "本地检测中"
      : state.sensingMode === "camera"
        ? "暂未看见你 · 已切到计时"
        : "计时陪伴中";
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

  return (
    <main
      className={isDesktop ? "app-shell app-shell--desktop" : "app-shell app-shell--preview"}
      style={isDesktop ? undefined : { backgroundImage: `url(${PREVIEW_IMAGE})` }}
      data-mode={state.mode}
      data-pet-attention={displayedAttentionFrame.phase}
    >
      <video ref={detector.videoRef} className="sensor-video" muted playsInline />

      <section
        className="coach-stage"
        data-pet-size={petSize}
        data-pet-attention={displayedAttentionFrame.phase}
        data-pet-rail={displayedAttentionFrame.rail ? "true" : "false"}
        data-pet-flying={displayedAttentionFrame.flying ? "true" : "false"}
        aria-label="Look Me 护眼陪伴"
      >
        <div className="coach-pet-shell">
          <img className="coach-pet" src={PET_IMAGE} alt="刘看山护眼小伙伴" />
          {displayedAttentionFrame.crying && (
            <>
              <img className="pet-tear pet-tear--stream" src={TEAR_IMAGE} alt="" />
              <img className="pet-tear pet-tear--drop" src={TEAR_IMAGE} alt="" />
            </>
          )}
          {(detector.blinkCount > 0 || petBlinkDemo) && (
            <span
              className={petBlinkDemo ? "pet-eyelid pet-eyelid--demo" : "pet-eyelid"}
              key={petBlinkDemo ? "demo" : detector.blinkCount}
              aria-hidden="true"
            />
          )}
        </div>
        {isDesktop && (
          <div
            className="window-drag-region"
            data-window-drag
            title="按住看山拖动"
            aria-hidden="true"
            onPointerDown={(event) => {
              if (event.button !== 0) {
                return;
              }
              windowDragPointer.current = event.pointerId;
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
                window.lookMe?.dragWindow("move", event.screenX, event.screenY);
              }
            }}
            onPointerUp={endWindowDrag}
            onPointerCancel={endWindowDrag}
            onLostPointerCapture={endWindowDrag}
          />
        )}

        {historyOpen && (
          <Suspense fallback={null}>
            <BlinkHistoryPanel
              history={displayedHistory}
              selectedDate={selectedHistoryDate}
              firstDate={firstHistoryDate}
              todayDate={todayDate}
              onSelectDate={setSelectedHistoryDate}
              onClose={() => setHistoryOpen(false)}
            />
          </Suspense>
        )}

        {!historyOpen && state.mode === "distance" && (
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
              onClick={() => dispatch({ type: "SKIP", now: Date.now() })}
            >
              <SkipForward size={16} weight="bold" aria-hidden />
              跳过
            </button>
          </article>
        )}

        {!historyOpen && state.mode === "permission" && (
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
              {detector.errorMessage && (
                <p className="inline-error" role="alert">{detector.errorMessage}</p>
              )}
              <div className="button-row">
                <button
                  className="primary-button"
                  type="button"
                  onClick={enableCamera}
                  disabled={detector.status === "starting"}
                >
                  <Camera size={17} weight="bold" aria-hidden />
                  {detector.status === "starting" ? "正在准备…" : "开启本地检测"}
                </button>
                <button className="secondary-button" type="button" onClick={useTimerOnly}>
                  <Timer size={17} weight="bold" aria-hidden />
                  只用计时提醒
                </button>
              </div>
              <div className="permission-meta">
                <span className="privacy-note">
                  <ShieldCheck size={14} weight="fill" aria-hidden />
                  随时可以暂停
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

        {!historyOpen && state.mode === "blink" && (
          <article className="coach-card coach-card--blink" aria-live="polite">
            <div className="card-icon card-icon--eye">
              <Eye size={25} weight="fill" aria-hidden />
            </div>
            <div className="blink-copy">
              <span className="eyebrow">眼睛有点忙啦</span>
              <h1>陪我慢慢眨 3 下</h1>
              <div className="blink-dots" aria-label={`已完成 ${state.guidedBlinks} 下`}>
                {[0, 1, 2].map((index) => (
                  <span
                    className={index < state.guidedBlinks ? "blink-dot blink-dot--done" : "blink-dot"}
                    key={index}
                  />
                ))}
              </div>
            </div>
          </article>
        )}

        {!historyOpen && state.mode === "idle" && (
          <>
            {statsOpen && (
              <article className="stats-panel" data-interactive aria-label="眨眼与看屏统计">
                <header className="stats-header">
                  <span className="stats-mark" aria-hidden>
                    <ChartLineUp size={19} weight="bold" />
                  </span>
                  <div>
                    <h2>眨眼与看屏</h2>
                    <p>
                      {hasVisibleFace
                        ? "当前连续检测段"
                        : hasCameraSession
                          ? "等待重新看见你"
                          : "需要开启本地检测"}
                    </p>
                  </div>
                  <button
                    className="stats-close"
                    type="button"
                    aria-label="收起眨眼统计"
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
                <div className="stats-footer">
                  <p className="stats-footnote">看屏时长按人脸可见估算</p>
                  <button
                    className="stats-history-button"
                    type="button"
                    onClick={() => {
                      setSelectedHistoryDate(todayDate);
                      setHistoryOpen(true);
                    }}
                  >
                    查看全天曲线
                  </button>
                </div>
              </article>
            )}

            {!displayedAttentionFrame.rail && (
              <article className="idle-companion" data-interactive>
                <div className="idle-status" title={sensingLabel}>
                  <span className="stats-eye-pulse" key={detector.blinkCount} aria-hidden>
                    <Eye size={14} weight="fill" />
                  </span>
                  {hasVisibleFace
                    ? blinkStats.rollingRate === null
                      ? `采集中 ${blinkStats.collectingSecondsRemaining} 秒`
                      : `${blinkStats.rollingRate} 次/分`
                    : sensingLabel}
                </div>
                <div className="idle-actions">
                  <button
                    className={statsOpen ? "icon-button icon-button--active" : "icon-button"}
                    type="button"
                    title="查看眨眼统计"
                    aria-label="查看眨眼统计"
                    aria-expanded={statsOpen}
                    onClick={() => setStatsOpen((open) => !open)}
                  >
                    <ChartLineUp size={18} weight="bold" aria-hidden />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title="现在远眺"
                    aria-label="现在远眺"
                    onClick={() => dispatch({ type: "START_DISTANCE", now: Date.now() })}
                  >
                    <Eye size={18} weight="bold" aria-hidden />
                  </button>
                  <button
                    className="icon-button"
                    type="button"
                    title="暂停 25 分钟"
                    aria-label="暂停 25 分钟"
                    onClick={() => dispatch({ type: "PAUSE", now: Date.now() })}
                  >
                    <Pause size={18} weight="fill" aria-hidden />
                  </button>
                </div>
              </article>
            )}
          </>
        )}

        {!historyOpen && state.mode === "paused" && (
          <article className="coach-card coach-card--paused" data-interactive>
            <div className="card-icon card-icon--moon">
              <Moon size={23} weight="fill" aria-hidden />
            </div>
            <div>
              <span className="eyebrow">安静一会儿</span>
              <h1>已暂停 25 分钟</h1>
              <button
                className="text-button text-button--dark"
                type="button"
                onClick={() => dispatch({ type: "RESUME", now: Date.now() })}
              >
                <Play size={15} weight="fill" aria-hidden />
                继续陪伴
              </button>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
