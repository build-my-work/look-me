import { describe, expect, it } from "vitest";
import {
  applyPetPersistence,
  PET_ATTENTION_COOLDOWN_MS,
  PetAttentionController,
  type PetAttentionFrame,
  type PetAttentionInput,
} from "./pet-attention";

function advanceTo(
  controller: PetAttentionController,
  from: number,
  to: number,
  overrides: Partial<PetAttentionInput> = {},
) {
  let frame = controller.update({
    now: from,
    sensing: true,
    parked: false,
    held: false,
    blinkCount: 0,
    reducedMotion: false,
    ...overrides,
  });

  for (let now = from + 250; now <= to; now += 250) {
    frame = controller.update({
      now,
      sensing: true,
      parked: false,
      held: false,
      blinkCount: 0,
      reducedMotion: false,
      ...overrides,
    });
  }
  return frame;
}

describe("PetAttentionController", () => {
  it("stays hidden for 10 seconds, then descends and cries at the bottom", () => {
    const controller = new PetAttentionController();

    expect(advanceTo(controller, 0, 9_750)).toMatchObject({
      phase: "hidden",
      position: 0,
      crying: false,
    });
    const halfway = advanceTo(controller, 9_750, 17_500);
    expect(halfway).toMatchObject({
      phase: "descending",
      crying: false,
    });
    expect(halfway.position).toBeCloseTo(0.5, 4);
    expect(advanceTo(controller, 17_500, 25_000)).toMatchObject({
      phase: "crying",
      position: 1,
      crying: true,
    });
  });

  it("pauses its clock while a manual panel is parked", () => {
    const controller = new PetAttentionController();
    const beforePanel = advanceTo(controller, 0, 15_000);

    const parked = advanceTo(controller, 15_000, 35_000, { parked: true });
    const resumed = controller.update({
      now: 35_250,
      sensing: true,
      parked: false,
      held: false,
      blinkCount: 0,
      reducedMotion: false,
    });

    expect(parked.phase).toBe("parked");
    expect(resumed.phase).toBe("descending");
    expect(resumed.position).toBeCloseTo(beforePanel.position, 1);
  });

  it("resets instead of escalating when face sensing is lost", () => {
    const controller = new PetAttentionController();
    advanceTo(controller, 0, 25_000);

    expect(controller.update({
      now: 25_250,
      sensing: false,
      parked: false,
      held: false,
      blinkCount: 0,
      reducedMotion: false,
    }).phase).toBe("parked");

    expect(controller.update({
      now: 25_500,
      sensing: true,
      parked: false,
      held: false,
      blinkCount: 0,
      reducedMotion: false,
    })).toMatchObject({ phase: "hidden", position: 0, crying: false });
  });

  it("turns a confirmed blink into recovery and a quiet cooldown", () => {
    const controller = new PetAttentionController();
    const visible = advanceTo(controller, 0, 20_000);

    const recovery = controller.update({
      now: 20_001,
      sensing: true,
      parked: false,
      held: false,
      blinkCount: 1,
      reducedMotion: false,
    });
    const cooledDown = advanceTo(controller, 20_001, 22_001, { blinkCount: 1 });

    expect(visible.position).toBeGreaterThan(0);
    expect(recovery).toMatchObject({ phase: "recovering", crying: false });
    expect(cooledDown).toMatchObject({ phase: "cooldown", position: 0 });

    const stillQuiet = advanceTo(
      controller,
      22_001,
      22_001 + PET_ATTENTION_COOLDOWN_MS - 1_000,
      { blinkCount: 1 },
    );
    expect(stillQuiet.phase).toBe("cooldown");
  });

  it("flies two complete rounds and then rests crying at the bottom", () => {
    const controller = new PetAttentionController();

    expect(advanceTo(controller, 0, 30_000)).toMatchObject({
      phase: "rampage",
      position: 1,
      crying: true,
      flying: true,
    });
    expect(advanceTo(controller, 30_000, 32_750).position).toBeCloseTo(0, 4);
    expect(advanceTo(controller, 32_750, 35_500).position).toBeCloseTo(1, 4);
    expect(advanceTo(controller, 35_500, 38_250).position).toBeCloseTo(0, 4);
    expect(advanceTo(controller, 38_250, 41_000).position).toBeCloseTo(1, 4);
    expect(advanceTo(controller, 41_000, 42_000)).toMatchObject({
      phase: "rampage",
      position: 1,
      crying: true,
      flying: false,
    });
  });

  it("uses one static lower-right crying pose for reduced motion", () => {
    const controller = new PetAttentionController();

    expect(advanceTo(controller, 0, 24_750, { reducedMotion: true }).phase)
      .toBe("hidden");
    expect(advanceTo(controller, 24_750, 40_000, { reducedMotion: true }))
      .toMatchObject({
        phase: "crying",
        position: 0.82,
        crying: true,
        flying: false,
      });
  });
});

describe("applyPetPersistence", () => {
  const hiddenFrame: PetAttentionFrame = {
    phase: "hidden",
    position: 0,
    crying: false,
    flying: false,
    rail: true,
  };

  it("keeps the existing auto-hide behavior when persistence is off", () => {
    expect(applyPetPersistence(hiddenFrame, false)).toBe(hiddenFrame);
  });

  it.each(["hidden", "cooldown"] as const)(
    "rests visibly in the upper-right during %s when persistence is on",
    (phase) => {
      expect(applyPetPersistence({ ...hiddenFrame, phase }, true)).toEqual({
        phase: "resting",
        position: 0,
        crying: false,
        flying: false,
        rail: true,
      });
    },
  );

  it("does not change an active reminder", () => {
    const descendingFrame: PetAttentionFrame = {
      phase: "descending",
      position: 0.4,
      crying: false,
      flying: false,
      rail: true,
    };

    expect(applyPetPersistence(descendingFrame, true)).toBe(descendingFrame);
  });
});
