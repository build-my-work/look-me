import { describe, expect, it } from "vitest";
import {
  PostureSignal,
  calculateFacePosition,
  type FacePosition,
} from "./posture-signal";

function calibrate(signal: PostureSignal, face: FacePosition = { x: 0.5, y: 0.52 }) {
  let result = signal.process({ timestamp: 0, face });
  for (let timestamp = 250; timestamp <= 3_500; timestamp += 250) {
    result = signal.process({
      timestamp,
      face: {
        x: face.x + (timestamp % 500 === 0 ? 0.004 : -0.004),
        y: face.y + (timestamp % 500 === 0 ? 0.004 : -0.004),
      },
    });
  }
  expect(result.state).toBe("seated");
  return result;
}

describe("calculateFacePosition", () => {
  it("uses the eye line as a stable face-position proxy", () => {
    const landmarks = Array.from({ length: 363 }, () => ({ x: 0, y: 0 }));
    landmarks[33] = { x: 0.4, y: 0.3 };
    landmarks[133] = { x: 0.46, y: 0.32 };
    landmarks[362] = { x: 0.54, y: 0.31 };
    landmarks[263] = { x: 0.6, y: 0.29 };

    expect(calculateFacePosition(landmarks)).toEqual({ x: 0.5, y: 0.305 });
  });
});

describe("PostureSignal", () => {
  it("counts one upward exit and keeps the user away until seated again", () => {
    const signal = new PostureSignal();
    calibrate(signal);

    signal.process({ timestamp: 3_750, face: { x: 0.5, y: 0.46 } });
    signal.process({ timestamp: 4_000, face: { x: 0.5, y: 0.37 } });
    signal.process({ timestamp: 4_250, face: { x: 0.5, y: 0.28 } });
    expect(signal.process({ timestamp: 4_500, face: null }).state).toBe("seated");

    const exited = signal.process({ timestamp: 5_250, face: null });
    expect(exited).toMatchObject({ state: "away", stoodUp: true });
    expect(signal.process({ timestamp: 5_500, face: null }).stoodUp).toBe(false);

    signal.process({ timestamp: 6_000, face: { x: 0.5, y: 0.22 } });
    signal.process({ timestamp: 6_500, face: { x: 0.5, y: 0.51 } });
    signal.process({ timestamp: 7_000, face: { x: 0.5, y: 0.52 } });
    signal.process({ timestamp: 7_500, face: { x: 0.5, y: 0.51 } });
    expect(signal.process({ timestamp: 8_000, face: { x: 0.5, y: 0.52 } }).state)
      .toBe("seated");
  });

  it("treats a sudden face loss from the seated region as unknown", () => {
    const signal = new PostureSignal();
    calibrate(signal);

    signal.process({ timestamp: 3_750, face: null });
    const lost = signal.process({ timestamp: 4_750, face: null });

    expect(lost).toMatchObject({ state: "unknown", stoodUp: false });
  });

  it("does not count a face leaving through the side as standing up", () => {
    const signal = new PostureSignal();
    calibrate(signal);

    signal.process({ timestamp: 3_750, face: { x: 0.62, y: 0.43 } });
    signal.process({ timestamp: 4_000, face: { x: 0.78, y: 0.34 } });
    signal.process({ timestamp: 4_250, face: { x: 0.92, y: 0.26 } });
    signal.process({ timestamp: 4_500, face: null });
    const lost = signal.process({ timestamp: 5_500, face: null });

    expect(lost).toMatchObject({ state: "unknown", stoodUp: false });
  });

  it("cancels a transient upward movement when the face returns", () => {
    const signal = new PostureSignal();
    calibrate(signal);

    signal.process({ timestamp: 3_750, face: { x: 0.5, y: 0.42 } });
    signal.process({ timestamp: 4_000, face: { x: 0.5, y: 0.28 } });
    const returned = signal.process({ timestamp: 4_250, face: { x: 0.5, y: 0.51 } });

    expect(returned).toMatchObject({ state: "seated", stoodUp: false });
  });

  it("accepts a stable lower seated position after the user returns", () => {
    const signal = new PostureSignal();
    calibrate(signal);

    signal.process({ timestamp: 3_750, face: { x: 0.5, y: 0.43 } });
    signal.process({ timestamp: 4_000, face: { x: 0.5, y: 0.34 } });
    signal.process({ timestamp: 4_250, face: { x: 0.5, y: 0.27 } });
    signal.process({ timestamp: 4_500, face: null });
    expect(signal.process({ timestamp: 5_250, face: null }).state).toBe("away");

    signal.process({ timestamp: 5_500, face: { x: 0.58, y: 0.68 } });
    signal.process({ timestamp: 6_000, face: { x: 0.58, y: 0.67 } });
    signal.process({ timestamp: 6_500, face: { x: 0.58, y: 0.68 } });
    expect(signal.process({ timestamp: 7_000, face: { x: 0.58, y: 0.67 } }).state)
      .toBe("seated");
  });
});
