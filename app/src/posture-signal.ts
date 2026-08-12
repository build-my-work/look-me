export type PostureState = "calibrating" | "seated" | "away" | "unknown";

interface FaceLandmark {
  x: number;
  y: number;
}

export interface FacePosition {
  x: number;
  y: number;
}

export interface PostureSample {
  timestamp: number;
  face: FacePosition | null;
}

export interface PostureSignalResult {
  state: PostureState;
  stateStartedAt: number;
}

const EYE_LINE_LANDMARKS = [33, 133, 362, 263] as const;
const CALIBRATION_DURATION_MS = 3_000;
const CALIBRATION_MIN_SAMPLES = 8;
const CALIBRATION_MAX_Y_SPREAD = 0.06;
const CALIBRATION_MAX_X_SPREAD = 0.12;
const TRAJECTORY_WINDOW_MS = 1_500;
const MIN_UPWARD_TRAVEL = 0.06;
const MIN_BASELINE_OFFSET = 0.08;
const TOP_EXIT_Y = 0.3;
const MIN_SAFE_X = 0.15;
const MAX_SAFE_X = 0.85;
const MAX_BASELINE_X_OFFSET = 0.2;
const EXIT_CONFIRM_MS = 750;
const UNKNOWN_CONFIRM_MS = 1_000;
const RETURN_CONFIRM_MS = 1_500;
const RETURN_Y_TOLERANCE = 0.08;
const BASELINE_ADAPT_BAND = 0.05;
const BASELINE_ADAPT_WEIGHT = 0.002;

interface TimedFacePosition extends FacePosition {
  timestamp: number;
}

function isFiniteFace(face: FacePosition | null): face is FacePosition {
  return Boolean(
    face &&
      Number.isFinite(face.x) &&
      Number.isFinite(face.y) &&
      face.x >= 0 &&
      face.x <= 1 &&
      face.y >= 0 &&
      face.y <= 1,
  );
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

function spread(values: number[]): number {
  return Math.max(...values) - Math.min(...values);
}

export function calculateFacePosition(
  landmarks: readonly FaceLandmark[],
): FacePosition | undefined {
  const eyeLine = EYE_LINE_LANDMARKS.map((index) => landmarks[index]);
  if (
    eyeLine.some(
      (point) =>
        !point || !Number.isFinite(point.x) || !Number.isFinite(point.y),
    )
  ) {
    return undefined;
  }

  return {
    x: eyeLine.reduce((total, point) => total + point.x, 0) / eyeLine.length,
    y: eyeLine.reduce((total, point) => total + point.y, 0) / eyeLine.length,
  };
}

export class PostureSignal {
  private state: PostureState = "calibrating";
  private stateStartedAt = 0;
  private baseline: FacePosition | null = null;
  private calibrationSamples: TimedFacePosition[] = [];
  private recentFaces: TimedFacePosition[] = [];
  private missingSince: number | null = null;
  private lastRisingAt: number | null = null;
  private returnSince: number | null = null;
  private lastTimestamp = Number.NEGATIVE_INFINITY;

  process(sample: PostureSample): PostureSignalResult {
    if (!Number.isFinite(sample.timestamp) || sample.timestamp <= this.lastTimestamp) {
      return this.result();
    }
    this.lastTimestamp = sample.timestamp;

    if (!isFiniteFace(sample.face)) {
      return this.processMissing(sample.timestamp);
    }

    this.missingSince = null;
    const face = { ...sample.face, timestamp: sample.timestamp };
    if (this.state === "calibrating" || this.baseline === null) {
      return this.processCalibration(face);
    }
    if (this.state === "away" || this.state === "unknown") {
      return this.processReturn(face);
    }
    return this.processSeated(face);
  }

  reset(): PostureSignalResult {
    this.state = "calibrating";
    this.stateStartedAt = 0;
    this.baseline = null;
    this.calibrationSamples = [];
    this.recentFaces = [];
    this.missingSince = null;
    this.lastRisingAt = null;
    this.returnSince = null;
    this.lastTimestamp = Number.NEGATIVE_INFINITY;
    return this.result();
  }

  private processCalibration(face: TimedFacePosition): PostureSignalResult {
    this.calibrationSamples.push(face);
    const windowStartedAt = face.timestamp - CALIBRATION_DURATION_MS;
    this.calibrationSamples = this.calibrationSamples.filter(
      (sample) => sample.timestamp >= windowStartedAt,
    );
    const first = this.calibrationSamples[0];
    if (
      this.calibrationSamples.length < CALIBRATION_MIN_SAMPLES ||
      !first ||
      face.timestamp - first.timestamp < CALIBRATION_DURATION_MS
    ) {
      return this.result();
    }

    const xValues = this.calibrationSamples.map((sample) => sample.x);
    const yValues = this.calibrationSamples.map((sample) => sample.y);
    if (
      spread(xValues) > CALIBRATION_MAX_X_SPREAD ||
      spread(yValues) > CALIBRATION_MAX_Y_SPREAD
    ) {
      return this.result();
    }

    this.baseline = { x: median(xValues), y: median(yValues) };
    this.recentFaces = [face];
    this.calibrationSamples = [];
    this.setState("seated", face.timestamp);
    return this.result();
  }

  private processSeated(face: TimedFacePosition): PostureSignalResult {
    const baseline = this.baseline;
    if (!baseline) {
      this.setState("calibrating", face.timestamp);
      return this.processCalibration(face);
    }

    this.recentFaces.push(face);
    const windowStartedAt = face.timestamp - TRAJECTORY_WINDOW_MS;
    this.recentFaces = this.recentFaces.filter(
      (sample) => sample.timestamp >= windowStartedAt,
    );
    const trajectoryOrigin = this.recentFaces.reduce((lowest, sample) =>
      sample.y > lowest.y ? sample : lowest,
    );
    const upwardTravel = trajectoryOrigin.y - face.y;
    const horizontalTravel = Math.abs(trajectoryOrigin.x - face.x);
    const movedUp =
      upwardTravel >= MIN_UPWARD_TRAVEL &&
      upwardTravel >= horizontalTravel * 1.2;
    const reachedExitZone =
      face.y <= baseline.y - MIN_BASELINE_OFFSET && face.y <= TOP_EXIT_Y;
    const horizontallySafe =
      face.x >= MIN_SAFE_X &&
      face.x <= MAX_SAFE_X &&
      Math.abs(face.x - baseline.x) <= MAX_BASELINE_X_OFFSET;

    if (movedUp && reachedExitZone && horizontallySafe) {
      this.lastRisingAt = face.timestamp;
    } else if (
      face.y >= baseline.y - BASELINE_ADAPT_BAND ||
      !horizontallySafe
    ) {
      this.lastRisingAt = null;
    } else if (
      this.lastRisingAt !== null &&
      face.timestamp - this.lastRisingAt >= TRAJECTORY_WINDOW_MS
    ) {
      this.lastRisingAt = null;
    }

    if (
      this.lastRisingAt === null &&
      horizontallySafe &&
      face.y >= baseline.y - BASELINE_ADAPT_BAND
    ) {
      this.baseline = {
        x:
          baseline.x * (1 - BASELINE_ADAPT_WEIGHT) +
          face.x * BASELINE_ADAPT_WEIGHT,
        y:
          baseline.y * (1 - BASELINE_ADAPT_WEIGHT) +
          face.y * BASELINE_ADAPT_WEIGHT,
      };
    }
    return this.result();
  }

  private processMissing(timestamp: number): PostureSignalResult {
    if (this.state === "calibrating") {
      this.calibrationSamples = [];
      return this.result();
    }
    if (this.state === "away" || this.state === "unknown") {
      this.returnSince = null;
      return this.result();
    }

    this.missingSince ??= timestamp;
    const missingDuration = timestamp - this.missingSince;
    if (this.lastRisingAt !== null && missingDuration >= EXIT_CONFIRM_MS) {
      this.setState("away", this.missingSince);
      this.lastRisingAt = null;
      return this.result();
    }
    if (missingDuration >= UNKNOWN_CONFIRM_MS) {
      this.setState("unknown", this.missingSince);
      this.lastRisingAt = null;
    }
    return this.result();
  }

  private processReturn(face: TimedFacePosition): PostureSignalResult {
    const baseline = this.baseline;
    if (!baseline) {
      this.setState("calibrating", face.timestamp);
      return this.processCalibration(face);
    }

    const backInSeatedRegion =
      face.y >= baseline.y - RETURN_Y_TOLERANCE &&
      face.x >= MIN_SAFE_X &&
      face.x <= MAX_SAFE_X;
    if (!backInSeatedRegion) {
      this.returnSince = null;
      return this.result();
    }

    this.returnSince ??= face.timestamp;
    if (face.timestamp - this.returnSince >= RETURN_CONFIRM_MS) {
      this.setState("seated", this.returnSince);
      this.returnSince = null;
      this.baseline = { x: face.x, y: face.y };
      this.recentFaces = [face];
    }
    return this.result();
  }

  private setState(state: PostureState, startedAt: number): void {
    this.state = state;
    this.stateStartedAt = startedAt;
    this.missingSince = null;
    this.returnSince = null;
  }

  private result(): PostureSignalResult {
    return {
      state: this.state,
      stateStartedAt: this.stateStartedAt,
    };
  }
}
