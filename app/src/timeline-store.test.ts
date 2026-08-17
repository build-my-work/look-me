import { describe, expect, it, vi } from "vitest";
import { TimelineRepository } from "./timeline-store";

describe("TimelineRepository", () => {
  it("keeps exact sparse events queryable with the state predecessor", async () => {
    const repository = new TimelineRepository();
    const listener = vi.fn();
    const unsubscribe = repository.subscribe(listener);

    const started = repository.record({
      at: 100.4,
      layer: "fact",
      type: "screen.started",
      spanId: "screen-1",
    });
    repository.record({
      at: 220,
      layer: "fact",
      type: "blink.detected",
    });
    repository.record({
      at: 340,
      layer: "fact",
      type: "screen.ended",
      spanId: "screen-1",
      causedBy: [started.id],
    });
    unsubscribe();

    const range = await repository.queryRange(300, 400);

    expect(listener).toHaveBeenCalledTimes(3);
    expect(started.at).toBe(100);
    expect(range.events.map((event) => event.type)).toEqual([
      "screen.started",
      "screen.ended",
    ]);
    expect(range.events[1].causedBy).toEqual([started.id]);
    expect(range.currentSessionId).toBe(repository.currentSessionId);
  });
});
