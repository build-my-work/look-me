import { describe, expect, it } from "vitest";
import {
  parsePetIdleActionPreference,
  resolvePetDisplayAction,
} from "./pet-idle-action";

describe("pet idle action preference", () => {
  it("defaults invalid or missing values to automatic rotation", () => {
    expect(parsePetIdleActionPreference(null)).toBe("auto");
    expect(parsePetIdleActionPreference("dance")).toBe("auto");
  });

  it.each(["auto", "yawn", "clap", "sit", "spin", "off"] as const)(
    "accepts %s",
    (preference) => {
      expect(parsePetIdleActionPreference(preference)).toBe(preference);
    },
  );
});

describe("pet display action", () => {
  it("mirrors an open mouth immediately instead of waiting for a yawn decision", () => {
    expect(
      resolvePetDisplayAction({
        petActionDemo: null,
        mouthOpen: true,
        cameraSettingsOpen: false,
        petActionPreview: null,
        idleActionEligible: true,
        petIdleAction: "auto",
      }),
    ).toBe("mouth-sync");
  });

  it("keeps explicit action demos ahead of live mouth mirroring", () => {
    expect(
      resolvePetDisplayAction({
        petActionDemo: "spin",
        mouthOpen: true,
        cameraSettingsOpen: true,
        petActionPreview: "yawn",
        idleActionEligible: true,
        petIdleAction: "auto",
      }),
    ).toBe("spin");
  });

  it("falls back to settings previews and idle behavior when the mouth is closed", () => {
    expect(
      resolvePetDisplayAction({
        petActionDemo: null,
        mouthOpen: false,
        cameraSettingsOpen: true,
        petActionPreview: "clap",
        idleActionEligible: true,
        petIdleAction: "auto",
      }),
    ).toBe("clap");

    expect(
      resolvePetDisplayAction({
        petActionDemo: null,
        mouthOpen: false,
        cameraSettingsOpen: false,
        petActionPreview: null,
        idleActionEligible: true,
        petIdleAction: "off",
      }),
    ).toBe("off");
  });

  it("keeps the mouth layer visible while closing in reverse", () => {
    expect(
      resolvePetDisplayAction({
        petActionDemo: null,
        mouthOpen: false,
        mouthClosing: true,
        cameraSettingsOpen: false,
        petActionPreview: null,
        idleActionEligible: true,
        petIdleAction: "auto",
      }),
    ).toBe("mouth-close-sync");
  });
});
