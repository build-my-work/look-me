export interface Point3D {
  x: number;
  y: number;
  z?: number;
}

export interface BlinkSample {
  timestamp: number;
  leftBlend: number;
  rightBlend: number;
  ear?: number;
}

const LEFT_EYE = [362, 385, 387, 263, 373, 380] as const;
const RIGHT_EYE = [33, 160, 158, 133, 153, 144] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function distance(a: Point3D, b: Point3D): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function eyeAspectRatio(
  landmarks: Point3D[],
  [p1, p2, p3, p4, p5, p6]: readonly number[],
): number | null {
  const points = [p1, p2, p3, p4, p5, p6].map((index) => landmarks[index]);
  if (points.some((point) => !point)) {
    return null;
  }

  const horizontal = 2 * distance(points[0], points[3]);
  if (horizontal === 0) {
    return null;
  }
  return (distance(points[1], points[5]) + distance(points[2], points[4])) / horizontal;
}

export function calculateAverageEyeAspectRatio(
  landmarks: Point3D[],
): number | undefined {
  const left = eyeAspectRatio(landmarks, LEFT_EYE);
  const right = eyeAspectRatio(landmarks, RIGHT_EYE);
  if (left === null || right === null) {
    return undefined;
  }
  return (left + right) / 2;
}

export class BlinkSignal {
  private openBlendBaseline = 0.08;
  private openEarBaseline: number | null = null;
  private closedAt: number | null = null;

  process(sample: BlinkSample): boolean {
    const averageBlend = (sample.leftBlend + sample.rightBlend) / 2;
    const eyesBalanced = Math.abs(sample.leftBlend - sample.rightBlend) < 0.35;
    const closeThreshold = clamp(this.openBlendBaseline + 0.38, 0.45, 0.68);
    const attenuatedCloseThreshold = clamp(
      this.openBlendBaseline + 0.24,
      0.3,
      0.42,
    );
    const openThreshold = clamp(this.openBlendBaseline + 0.16, 0.18, 0.34);
    const earRatio =
      sample.ear !== undefined && this.openEarBaseline !== null
        ? sample.ear / this.openEarBaseline
        : null;
    const earConfirmsClosure =
      earRatio === null || earRatio < 0.72;
    const earStronglyConfirmsClosure = earRatio !== null && earRatio < 0.62;
    const looksClosed =
      eyesBalanced &&
      ((averageBlend >= closeThreshold &&
        (earConfirmsClosure || averageBlend > 0.82)) ||
        (averageBlend >= attenuatedCloseThreshold &&
          earStronglyConfirmsClosure));

    if (this.closedAt === null) {
      if (looksClosed) {
        this.closedAt = sample.timestamp;
        return false;
      }

      if (averageBlend < 0.35) {
        this.openBlendBaseline =
          this.openBlendBaseline * 0.9 + averageBlend * 0.1;
        if (sample.ear !== undefined) {
          this.openEarBaseline =
            this.openEarBaseline === null
              ? sample.ear
              : this.openEarBaseline * 0.9 + sample.ear * 0.1;
        }
      }
      return false;
    }

    if (averageBlend <= openThreshold) {
      const closedDuration = sample.timestamp - this.closedAt;
      this.closedAt = null;
      return closedDuration >= 45 && closedDuration <= 800;
    }

    if (sample.timestamp - this.closedAt > 1_000) {
      this.closedAt = null;
    }
    return false;
  }

  reset(): void {
    this.closedAt = null;
  }
}
