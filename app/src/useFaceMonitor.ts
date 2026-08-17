import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BlinkSignal,
  calculateAverageEyeAspectRatio,
} from "./blink-signal";
import {
  PostureSignal,
  calculateFacePosition,
  type PostureState,
} from "./posture-signal";
import { MouthSignal } from "./mouth-signal";
import { YAWN_MIN_OPEN_MS, YawnSignal } from "./yawn-signal";

export type FaceMonitorStatus = "idle" | "starting" | "ready" | "error";

export interface BlinkDetectionEvent {
  at: number;
  closedAt: number;
  openedAt: number;
  closedDurationMs: number;
  peakLeftBlend: number;
  peakRightBlend: number;
  minimumEar: number | null;
}

export interface MouthTransitionEvent {
  at: number;
  state: "opened" | "closed";
  jawOpen: number;
  reason: "detected" | "face-lost";
}

export interface YawnDetectionEvent {
  at: number;
  openedAt: number;
  openDurationMs: number;
  thresholdMs: number;
}

export interface FaceMonitor {
  status: FaceMonitorStatus;
  errorMessage: string | null;
  faceVisible: boolean;
  blinkCount: number;
  blinkTimestamps: readonly number[];
  blinkEvents: readonly BlinkDetectionEvent[];
  yawnCount: number;
  yawnEvents: readonly YawnDetectionEvent[];
  mouthEvents: readonly MouthTransitionEvent[];
  mouthOpen: boolean;
  postureState: PostureState;
  postureStateSince: number | null;
  standUpTimestamps: readonly number[];
  sessionStartedAt: number | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<boolean>;
  suspend: () => void;
  stop: () => void;
}

const DETECTION_INTERVAL_MS = 50;
const FACE_VISIBILITY_GRACE_MS = 1_000;

function getBlendshapeScore(
  categories: Array<{ categoryName?: string; score?: number }>,
  name: string,
): number {
  return categories.find((category) => category.categoryName === name)?.score ?? 0;
}

function describeCameraError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "没有获得摄像头权限，眨眼提醒已暂停。";
    }
    if (error.name === "NotFoundError") {
      return "没有找到可用摄像头，眨眼提醒已暂停。";
    }
    if (error.name === "NotReadableError") {
      return "摄像头正被其他应用占用，眨眼提醒已暂停。";
    }
  }
  return "本地检测暂时无法启动，眨眼提醒已暂停。";
}

export function useFaceMonitor(): FaceMonitor {
  const [status, setStatus] = useState<FaceMonitorStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);
  const [blinkEvents, setBlinkEvents] = useState<BlinkDetectionEvent[]>([]);
  const [mouthEvents, setMouthEvents] = useState<MouthTransitionEvent[]>([]);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [yawnEvents, setYawnEvents] = useState<YawnDetectionEvent[]>([]);
  const [postureState, setPostureState] =
    useState<PostureState>("calibrating");
  const [postureStateSince, setPostureStateSince] = useState<number | null>(null);
  const [standUpTimestamps, setStandUpTimestamps] = useState<number[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const faceVisibleRef = useRef(false);
  const postureStateRef = useRef<PostureState>("calibrating");
  const lastFaceSeenAtRef = useRef(0);
  const lastDetectionAtRef = useRef(0);
  const blinkSignalRef = useRef(new BlinkSignal());
  const mouthSignalRef = useRef(new MouthSignal());
  const yawnSignalRef = useRef(new YawnSignal());
  const postureSignalRef = useRef(new PostureSignal());
  const startGenerationRef = useRef(0);
  const startPromiseRef = useRef<Promise<boolean> | null>(null);

  const resetPostureSignal = useCallback(() => {
    postureSignalRef.current.reset();
    postureStateRef.current = "calibrating";
    setPostureState("calibrating");
    setPostureStateSince(null);
  }, []);

  const cleanup = useCallback(() => {
    startGenerationRef.current += 1;
    startPromiseRef.current = null;
    runningRef.current = false;
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    blinkSignalRef.current.reset();
    mouthSignalRef.current.reset();
    yawnSignalRef.current.reset();
    resetPostureSignal();
    faceVisibleRef.current = false;
    lastFaceSeenAtRef.current = 0;
    lastDetectionAtRef.current = 0;
    setFaceVisible(false);
    setMouthOpen(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [resetPostureSignal]);

  const suspend = useCallback(() => {
    cleanup();
    setStatus((currentStatus) =>
      currentStatus === "error" ? "error" : "idle",
    );
  }, [cleanup]);

  const stop = useCallback(() => {
    cleanup();
    setBlinkEvents([]);
    setMouthEvents([]);
    setYawnEvents([]);
    setStandUpTimestamps([]);
    setSessionStartedAt(null);
    setStatus("idle");
    setErrorMessage(null);
  }, [cleanup]);

  const start = useCallback((): Promise<boolean> => {
    if (runningRef.current) {
      return Promise.resolve(true);
    }
    if (startPromiseRef.current) {
      return startPromiseRef.current;
    }

    const requestId = startGenerationRef.current + 1;
    startGenerationRef.current = requestId;
    setStatus("starting");
    setErrorMessage(null);
    const startPromise = (async () => {
      let acquiredStream: MediaStream | null = null;
      let acquiredLandmarker: FaceLandmarker | null = null;

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new DOMException("Camera API unavailable", "NotFoundError");
        }

        acquiredStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 24, max: 24 },
          },
        });
        if (requestId !== startGenerationRef.current) {
          acquiredStream.getTracks().forEach((track) => track.stop());
          return false;
        }
        streamRef.current = acquiredStream;

        const video = videoRef.current;
        if (!video) {
          throw new Error("Video element is not ready");
        }
        video.srcObject = acquiredStream;
        await video.play();
        if (requestId !== startGenerationRef.current) {
          acquiredStream.getTracks().forEach((track) => track.stop());
          if (video.srcObject === acquiredStream) {
            video.srcObject = null;
          }
          return false;
        }

        const wasmRoot = new URL("mediapipe/wasm", document.baseURI)
          .toString()
          .replace(/\/$/, "");
        const modelPath = new URL(
          "models/face_landmarker.task",
          document.baseURI,
        ).toString();
        const vision = await FilesetResolver.forVisionTasks(wasmRoot);
        if (requestId !== startGenerationRef.current) {
          return false;
        }
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: "CPU",
          },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });
        acquiredLandmarker = landmarker;
        if (requestId !== startGenerationRef.current) {
          landmarker.close();
          return false;
        }
        landmarkerRef.current = landmarker;
        runningRef.current = true;
        setSessionStartedAt((startedAt) => startedAt ?? Date.now());
        setStatus("ready");

        const detect = (timestamp: number) => {
          if (!runningRef.current) {
            return;
          }

          if (
            timestamp - lastDetectionAtRef.current >= DETECTION_INTERVAL_MS &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          ) {
            lastDetectionAtRef.current = timestamp;
            const result = landmarker.detectForVideo(video, timestamp);
            const categories = result.faceBlendshapes[0]?.categories ?? [];
            const landmarks = result.faceLandmarks[0];
            const hasFace = Boolean(landmarks && categories.length > 0);
            const wallClockNow = Date.now();

            if (hasFace) {
              lastFaceSeenAtRef.current = timestamp;
              if (!faceVisibleRef.current) {
                faceVisibleRef.current = true;
                setFaceVisible(true);
              }
            } else if (
              faceVisibleRef.current &&
              timestamp - lastFaceSeenAtRef.current >= FACE_VISIBILITY_GRACE_MS
            ) {
              faceVisibleRef.current = false;
              setFaceVisible(false);
            }

            const postureResult = postureSignalRef.current.process({
              timestamp,
              face: hasFace && landmarks
                ? (calculateFacePosition(landmarks) ?? null)
                : null,
            });
            if (postureResult.state !== postureStateRef.current) {
              postureStateRef.current = postureResult.state;
              setPostureState(postureResult.state);
              setPostureStateSince(
                postureResult.state === "calibrating"
                  ? null
                  : wallClockNow -
                      Math.max(0, timestamp - postureResult.stateStartedAt),
              );
            }
            if (postureResult.stoodUp) {
              const stoodUpAt =
                wallClockNow - Math.max(0, timestamp - postureResult.stateStartedAt);
              setStandUpTimestamps((timestamps) => [...timestamps, stoodUpAt]);
            }

            if (hasFace && landmarks) {
              const blinkSample = {
                timestamp,
                leftBlend: getBlendshapeScore(categories, "eyeBlinkLeft"),
                rightBlend: getBlendshapeScore(categories, "eyeBlinkRight"),
                ear: calculateAverageEyeAspectRatio(landmarks),
              };
              const didBlink = blinkSignalRef.current.process(blinkSample);
              const blinkDetection = blinkSignalRef.current.getLastDetection();
              if (didBlink && blinkDetection) {
                setBlinkEvents((events) => [
                  ...events,
                  {
                    at: wallClockNow,
                    closedAt:
                      wallClockNow -
                      (blinkDetection.openedAt - blinkDetection.closedAt),
                    openedAt: wallClockNow,
                    closedDurationMs: blinkDetection.closedDurationMs,
                    peakLeftBlend: blinkDetection.peakLeftBlend,
                    peakRightBlend: blinkDetection.peakRightBlend,
                    minimumEar: blinkDetection.minimumEar,
                  },
                ]);
              }
              const jawOpen = getBlendshapeScore(categories, "jawOpen");
              const mouthResult = mouthSignalRef.current.process({
                timestamp,
                jawOpen,
              });
              setMouthOpen(mouthResult.open);
              if (mouthResult.transition) {
                setMouthEvents((events) => [
                  ...events,
                  {
                    at: wallClockNow,
                    state: mouthResult.transition as "opened" | "closed",
                    jawOpen,
                    reason: "detected",
                  },
                ]);
              }
              const yawnDetection = yawnSignalRef.current.process({
                timestamp,
                mouthOpen: mouthResult.open,
              });
              if (yawnDetection) {
                setYawnEvents((events) => [
                  ...events,
                  {
                    at: wallClockNow,
                    openedAt:
                      wallClockNow -
                      (yawnDetection.detectedAt - yawnDetection.openedAt),
                    openDurationMs: yawnDetection.openDurationMs,
                    thresholdMs: YAWN_MIN_OPEN_MS,
                  },
                ]);
              }
            } else {
              blinkSignalRef.current.reset();
              const mouthResult = mouthSignalRef.current.process({
                timestamp,
                jawOpen: 0,
              });
              setMouthOpen(mouthResult.open);
              if (mouthResult.transition === "closed") {
                setMouthEvents((events) => [
                  ...events,
                  {
                    at: wallClockNow,
                    state: "closed",
                    jawOpen: 0,
                    reason: "face-lost",
                  },
                ]);
              }
              yawnSignalRef.current.process({ timestamp, mouthOpen: false });
            }
          }

          animationFrameRef.current = requestAnimationFrame(detect);
        };

        animationFrameRef.current = requestAnimationFrame(detect);
        return true;
      } catch (error) {
        if (requestId !== startGenerationRef.current) {
          acquiredStream?.getTracks().forEach((track) => track.stop());
          acquiredLandmarker?.close();
          return false;
        }
        cleanup();
        setStatus("error");
        setErrorMessage(describeCameraError(error));
        return false;
      } finally {
        if (requestId === startGenerationRef.current) {
          startPromiseRef.current = null;
        }
      }
    })();
    startPromiseRef.current = startPromise;
    return startPromise;
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  const blinkTimestamps = blinkEvents.map((event) => event.at);

  return {
    status,
    errorMessage,
    faceVisible,
    blinkCount: blinkEvents.length,
    blinkTimestamps,
    blinkEvents,
    yawnCount: yawnEvents.length,
    yawnEvents,
    mouthEvents,
    mouthOpen,
    postureState,
    postureStateSince,
    standUpTimestamps,
    sessionStartedAt,
    videoRef,
    start,
    suspend,
    stop,
  };
}
