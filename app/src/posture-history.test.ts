import { describe, expect, it } from "vitest";
import {
  createPostureHistory,
  parsePostureHistory,
  prunePostureHistory,
  recordPostureInterval,
  recordStandUp,
  summarizePostureDay,
} from "./posture-history";

describe("posture history", () => {
  it("splits seated and away durations at minute boundaries", () => {
    const startedAt = new Date(2026, 7, 13, 9, 30, 50).getTime();
    let history = recordPostureInterval(
      createPostureHistory(),
      "seated",
      startedAt,
      startedAt + 30_000,
    );
    history = recordPostureInterval(
      history,
      "away",
      startedAt + 30_000,
      startedAt + 50_000,
    );

    expect(history.days["2026-08-13"]["570"]).toEqual({
      seatedMs: 10_000,
      awayMs: 0,
      standUps: 0,
    });
    expect(history.days["2026-08-13"]["571"]).toEqual({
      seatedMs: 20_000,
      awayMs: 20_000,
      standUps: 0,
    });
  });

  it("records stand-up transitions without exact timestamps in storage", () => {
    const timestamp = new Date(2026, 7, 13, 9, 30, 20).getTime();
    const history = recordStandUp(createPostureHistory(), timestamp);

    expect(history.days["2026-08-13"]["570"]).toEqual({
      seatedMs: 0,
      awayMs: 0,
      standUps: 1,
    });
    expect(JSON.stringify(history)).not.toContain(String(timestamp));
  });

  it("summarizes a selected day", () => {
    const startedAt = new Date(2026, 7, 13, 9, 30, 0).getTime();
    let history = recordPostureInterval(
      createPostureHistory(),
      "seated",
      startedAt,
      startedAt + 45_000,
    );
    history = recordPostureInterval(
      history,
      "away",
      startedAt + 45_000,
      startedAt + 60_000,
    );
    history = recordStandUp(history, startedAt + 45_000);

    expect(summarizePostureDay(history, "2026-08-13")).toEqual({
      seatedMs: 45_000,
      awayMs: 15_000,
      standUps: 1,
    });
  });

  it("recovers safely from malformed persisted data", () => {
    expect(parsePostureHistory("not-json")).toEqual(createPostureHistory());
    expect(parsePostureHistory('{"version":2,"days":{}}')).toEqual(
      createPostureHistory(),
    );
  });

  it("retains today and the previous 29 local dates", () => {
    const history = {
      version: 1 as const,
      days: {
        "2026-07-14": { "0": { seatedMs: 60_000, awayMs: 0, standUps: 0 } },
        "2026-07-15": { "0": { seatedMs: 60_000, awayMs: 0, standUps: 0 } },
        "2026-08-13": { "0": { seatedMs: 0, awayMs: 60_000, standUps: 1 } },
        "2026-08-14": { "0": { seatedMs: 0, awayMs: 60_000, standUps: 1 } },
      },
    };

    expect(Object.keys(prunePostureHistory(history, "2026-08-13").days)).toEqual([
      "2026-07-15",
      "2026-08-13",
    ]);
  });
});
