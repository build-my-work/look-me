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
import { YawnSignal } from "./yawn-signal";

export type FaceMonitorStatus = "idle" | "starting" | "ready" | "error";

export interface BlinkDetectionEvent {
  id: number;
  at: number;
}

export interface YawnDetectionEvent {
  id: number;
  at: number;
}

export interface FaceMonitor {
  status: FaceMonitorStatus;
  errorMessage: string | null;
  faceVisible: boolean;
  lastDetectionAt: number | null;
  blinkCount: number;
  blinkEvents: readonly BlinkDetectionEvent[];
  yawnEvents: readonly YawnDetectionEvent[];
  mouthOpen: boolean;
  postureState: PostureState;
  postureStateSince: number | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<boolean>;
  suspend: () => void;
  stop: () => void;
}

const DETECTION_INTERVAL_MS = 50;
const DETECTION_PUBLISH_INTERVAL_MS = 250;
const FACE_VISIBILITY_GRACE_MS = 1_000;
const MAX_BUFFERED_DETECTION_EVENTS = 64;

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
  const [lastDetectionAt, setLastDetectionAt] = useState<number | null>(null);
  const [blinkCount, setBlinkCount] = useState(0);
  const [blinkEvents, setBlinkEvents] = useState<BlinkDetectionEvent[]>([]);
  const [mouthOpen, setMouthOpen] = useState(false);
  const [yawnEvents, setYawnEvents] = useState<YawnDetectionEvent[]>([]);
  const [postureState, setPostureState] =
    useState<PostureState>("calibrating");
  const [postureStateSince, setPostureStateSince] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const faceVisibleRef = useRef(false);
  const postureStateRef = useRef<PostureState>("calibrating");
  const lastFaceSeenAtRef = useRef(0);
  const lastInferenceTimestampRef = useRef(0);
  const lastProcessedVideoTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const lastPublishedDetectionAtRef = useRef(0);
  const blinkEventIdRef = useRef(0);
  const yawnEventIdRef = useRef(0);
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
    lastInferenceTimestampRef.current = 0;
    lastProcessedVideoTimeRef.current = Number.NEGATIVE_INFINITY;
    lastPublishedDetectionAtRef.current = 0;
    setFaceVisible(false);
    setLastDetectionAt(null);
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
    setBlinkCount(0);
    setBlinkEvents([]);
    setYawnEvents([]);
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
        setStatus("ready");

        const detect = (timestamp: number) => {
          if (!runningRef.current) {
            return;
          }

          const videoTime = video.currentTime;
          if (
            timestamp - lastInferenceTimestampRef.current >=
              DETECTION_INTERVAL_MS &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            Number.isFinite(videoTime) &&
            videoTime !== lastProcessedVideoTimeRef.current
          ) {
            lastInferenceTimestampRef.current = timestamp;
            lastProcessedVideoTimeRef.current = videoTime;
            let result: ReturnType<FaceLandmarker["detectForVideo"]>;
            try {
              result = landmarker.detectForVideo(video, timestamp);
            } catch (error) {
              if (requestId === startGenerationRef.current) {
                cleanup();
                setStatus("error");
                setErrorMessage(describeCameraError(error));
              }
              return;
            }
            const categories = result.faceBlendshapes[0]?.categories ?? [];
            const landmarks = result.faceLandmarks[0];
            const hasFace = Boolean(landmarks && categories.length > 0);
            const wallClockNow = Date.now();
            if (
              lastPublishedDetectionAtRef.current === 0 ||
              wallClockNow < lastPublishedDetectionAtRef.current ||
              wallClockNow - lastPublishedDetectionAtRef.current >=
                DETECTION_PUBLISH_INTERVAL_MS
            ) {
              lastPublishedDetectionAtRef.current = wallClockNow;
              setLastDetectionAt(wallClockNow);
            }

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
            if (hasFace && landmarks) {
              const blinkSample = {
                timestamp,
                leftBlend: getBlendshapeScore(categories, "eyeBlinkLeft"),
                rightBlend: getBlendshapeScore(categories, "eyeBlinkRight"),
                ear: calculateAverageEyeAspectRatio(landmarks),
              };
              const didBlink = blinkSignalRef.current.process(blinkSample);
              if (didBlink) {
                const event = {
                  id: ++blinkEventIdRef.current,
                  at: wallClockNow,
                };
                setBlinkCount((count) => count + 1);
                setBlinkEvents((events) => [
                  ...events.slice(-(MAX_BUFFERED_DETECTION_EVENTS - 1)),
                  event,
                ]);
              }
              const jawOpen = getBlendshapeScore(categories, "jawOpen");
              const mouthResult = mouthSignalRef.current.process({
                timestamp,
                jawOpen,
              });
              setMouthOpen(mouthResult.open);
              const yawnDetection = yawnSignalRef.current.process({
                timestamp,
                mouthOpen: mouthResult.open,
              });
              if (yawnDetection) {
                const event = {
                  id: ++yawnEventIdRef.current,
                  at: wallClockNow,
                };
                setYawnEvents((events) => [
                  ...events.slice(-(MAX_BUFFERED_DETECTION_EVENTS - 1)),
                  event,
                ]);
              }
            } else {
              blinkSignalRef.current.reset();
              const mouthResult = mouthSignalRef.current.process({
                timestamp,
                jawOpen: 0,
              });
              setMouthOpen(mouthResult.open);
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

  return {
    status,
    errorMessage,
    faceVisible,
    lastDetectionAt,
    blinkCount,
    blinkEvents,
    yawnEvents,
    mouthOpen,
    postureState,
    postureStateSince,
    videoRef,
    start,
    suspend,
    stop,
  };
}
