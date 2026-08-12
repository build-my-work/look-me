import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BlinkSignal,
  calculateAverageEyeAspectRatio,
} from "./blink-signal";

export type DetectorStatus = "idle" | "starting" | "ready" | "error";

interface BlinkDetector {
  status: DetectorStatus;
  errorMessage: string | null;
  faceVisible: boolean;
  blinkCount: number;
  blinkTimestamps: readonly number[];
  sessionStartedAt: number | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  start: () => Promise<boolean>;
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
      return "没有获得摄像头权限。你仍可使用计时提醒。";
    }
    if (error.name === "NotFoundError") {
      return "没有找到可用摄像头。你仍可使用计时提醒。";
    }
    if (error.name === "NotReadableError") {
      return "摄像头正被其他应用占用。稍后可以再试。";
    }
  }
  return "本地检测暂时无法启动。你仍可使用计时提醒。";
}

export function useBlinkDetector(): BlinkDetector {
  const [status, setStatus] = useState<DetectorStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [faceVisible, setFaceVisible] = useState(false);
  const [blinkTimestamps, setBlinkTimestamps] = useState<number[]>([]);
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const faceVisibleRef = useRef(false);
  const lastFaceSeenAtRef = useRef(0);
  const lastDetectionAtRef = useRef(0);
  const blinkSignalRef = useRef(new BlinkSignal());

  const cleanup = useCallback(() => {
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
    faceVisibleRef.current = false;
    lastFaceSeenAtRef.current = 0;
    setFaceVisible(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
    setBlinkTimestamps([]);
    setSessionStartedAt(null);
    setStatus("idle");
    setErrorMessage(null);
  }, [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    if (runningRef.current) {
      return true;
    }

    setStatus("starting");
    setErrorMessage(null);
    setBlinkTimestamps([]);
    setSessionStartedAt(null);

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("Camera API unavailable", "NotFoundError");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 24, max: 24 },
        },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) {
        throw new Error("Video element is not ready");
      }
      video.srcObject = stream;
      await video.play();

      const wasmRoot = new URL("mediapipe/wasm", document.baseURI)
        .toString()
        .replace(/\/$/, "");
      const modelPath = new URL(
        "models/face_landmarker.task",
        document.baseURI,
      ).toString();
      const vision = await FilesetResolver.forVisionTasks(wasmRoot);
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
      landmarkerRef.current = landmarker;
      runningRef.current = true;
      setSessionStartedAt(Date.now());
      setStatus("ready");

      const detect = (timestamp: number) => {
        if (!runningRef.current) {
          return;
        }

        if (
          document.visibilityState === "visible" &&
          timestamp - lastDetectionAtRef.current >= DETECTION_INTERVAL_MS &&
          video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
          lastDetectionAtRef.current = timestamp;
          const result = landmarker.detectForVideo(video, timestamp);
          const categories = result.faceBlendshapes[0]?.categories ?? [];
          const landmarks = result.faceLandmarks[0];
          const hasFace = Boolean(landmarks && categories.length > 0);

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

          if (hasFace) {
            const didBlink = blinkSignalRef.current.process({
              timestamp,
              leftBlend: getBlendshapeScore(categories, "eyeBlinkLeft"),
              rightBlend: getBlendshapeScore(categories, "eyeBlinkRight"),
              ear: calculateAverageEyeAspectRatio(landmarks),
            });
            if (didBlink) {
              setBlinkTimestamps((timestamps) => [...timestamps, Date.now()]);
            }
          } else {
            blinkSignalRef.current.reset();
          }
        }

        animationFrameRef.current = requestAnimationFrame(detect);
      };

      animationFrameRef.current = requestAnimationFrame(detect);
      return true;
    } catch (error) {
      cleanup();
      setStatus("error");
      setErrorMessage(describeCameraError(error));
      return false;
    }
  }, [cleanup]);

  useEffect(() => cleanup, [cleanup]);

  return {
    status,
    errorMessage,
    faceVisible,
    blinkCount: blinkTimestamps.length,
    blinkTimestamps,
    sessionStartedAt,
    videoRef,
    start,
    stop,
  };
}
