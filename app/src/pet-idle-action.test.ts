import { describe, expect, it } from "vitest";
import { parsePetIdleActionPreference } from "./pet-idle-action";

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
