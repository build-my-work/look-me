import { describe, expect, it } from "vitest";
import { isPetClick } from "./pet-pointer";

describe("pet pointer gesture", () => {
  it("keeps a short left-button gesture below the drag threshold", () => {
    expect(
      isPetClick(
        { screenX: 100, screenY: 100 },
        { screenX: 103, screenY: 104 },
      ),
    ).toBe(true);
  });

  it("does not open settings after a drag", () => {
    expect(
      isPetClick(
        { screenX: 100, screenY: 100 },
        { screenX: 106, screenY: 100 },
      ),
    ).toBe(false);
  });
});
