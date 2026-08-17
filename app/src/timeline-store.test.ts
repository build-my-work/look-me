import { describe, expect, it, vi } from "vitest";
import { summarizeTimeline } from "./timeline-analytics";
import { TimelineRepository } from "./timeline-store";

describe("TimelineRepository", () => {
  it("requires an active collection session", () => {
    const repository = new TimelineRepository();

    expect(() =>
      repository.record({ at: 100, type: "blink.detected" }),
    ).toThrow("active collection session");
  });

  it("stores sparse events and collection coverage", async () => {
    const repository = new TimelineRepository();
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);
    const sessionId = repository.startSession(50.4);

    repository.record({
      at: 100.4,
      type: "screen.started",
      spanId: "screen-1",
    });
    repository.record({ at: 220, type: "blink.detected" });
    repository.record({
      at: 340,
      type: "screen.ended",
      spanId: "screen-1",
    });
    unsubscribe();

    const range = await repository.queryRange(300, 400);

    expect(listener).toHaveBeenCalledTimes(4);
    expect(range.events.map((event) => event.type)).toEqual([
      "screen.started",
      "screen.ended",
    ]);
    expect(range.events[0].at).toBe(100);
    expect(range.activeSessionId).toBe(sessionId);
    expect(range.sessions).toEqual([
      { id: sessionId, startedAt: 50, lastSeenAt: 50 },
    ]);

    repository.endSession(500.2);
    expect(repository.getSnapshot()).toMatchObject({
      activeSessionId: null,
      sessions: [
        {
          id: sessionId,
          startedAt: 50,
          lastSeenAt: 500,
          endedAt: 500,
        },
      ],
    });
  });

  it("keeps the owner session when selecting an unclosed predecessor", async () => {
    const repository = new TimelineRepository();
    const sessionId = repository.startSession(100);
    repository.record({
      at: 200,
      type: "screen.started",
      spanId: "screen-1",
    });
    repository.endSession(300);

    const range = await repository.queryRange(1_000, 2_000);

    expect(range.sessions).toEqual([
      {
        id: sessionId,
        startedAt: 100,
        lastSeenAt: 300,
        endedAt: 300,
      },
    ]);
    expect(summarizeTimeline(range, 1_000, 2_000, 2_000).screenMs).toBe(0);
  });

  it("never ends a session before its latest event", () => {
    const repository = new TimelineRepository();
    const sessionId = repository.startSession(100);
    repository.record({ at: 500, type: "blink.detected" });

    repository.endSession(400);

    expect(repository.getSnapshot().sessions).toEqual([
      {
        id: sessionId,
        startedAt: 100,
        lastSeenAt: 500,
        endedAt: 500,
      },
    ]);
  });

  it("uses the latest real observation when ending an active session", () => {
    const repository = new TimelineRepository();
    const sessionId = repository.startSession(100);
    repository.startSession(500);

    repository.endSession(400);

    expect(repository.getSnapshot().sessions).toEqual([
      {
        id: sessionId,
        startedAt: 100,
        lastSeenAt: 500,
        endedAt: 500,
      },
    ]);
  });

  it("bounds an active session to the retention window plus span predecessors", () => {
    const repository = new TimelineRepository();
    const sessionId = repository.startSession(0);
    repository.record({ at: 100, type: "blink.detected" });
    repository.record({
      at: 200,
      type: "screen.started",
      spanId: "screen-1",
    });

    repository.startSession(31 * 24 * 60 * 60_000);

    expect(repository.getSnapshot()).toMatchObject({
      activeSessionId: sessionId,
      sessions: [{ id: sessionId }],
      events: [
        {
          sessionId,
          at: 200,
          type: "screen.started",
          spanId: "screen-1",
        },
      ],
    });
  });
});
