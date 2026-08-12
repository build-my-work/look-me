import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { TimelineRepository } from "./timeline-store";

const DAY_MS = 24 * 60 * 60_000;

describe("TimelineRepository IndexedDB persistence", () => {
  it("reads persisted ranges after restart and prunes expired point events", async () => {
    const startedAt = Date.now();
    const writer = new TimelineRepository();
    const sessionId = writer.startSession(startedAt);
    writer.record({ at: startedAt + 100, type: "blink.detected" });
    writer.record({
      at: startedAt + 200,
      type: "screen.started",
      spanId: "screen-1",
    });
    writer.record({
      at: startedAt + 300,
      type: "screen.ended",
      spanId: "screen-1",
    });
    writer.endSession(startedAt + 400);

    const reader = new TimelineRepository();
    await vi.waitFor(async () => {
      const range = await reader.queryRange(startedAt + 50, startedAt + 350);
      expect(range.events.map((event) => event.type)).toEqual([
        "blink.detected",
        "screen.started",
        "screen.ended",
      ]);
      expect(range.sessions).toContainEqual({
        id: sessionId,
        startedAt,
        lastSeenAt: startedAt + 400,
        endedAt: startedAt + 400,
      });
    });

    const pruner = new TimelineRepository();
    pruner.startSession(startedAt + 31 * DAY_MS);

    await vi.waitFor(async () => {
      const range = await reader.queryRange(startedAt, startedAt + 1_000);
      expect(range.events.map((event) => event.type)).toEqual([
        "screen.started",
        "screen.ended",
      ]);
    });
  });
});
