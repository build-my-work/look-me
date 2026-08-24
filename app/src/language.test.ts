import { describe, expect, it } from "vitest";
import {
  isLanguagePreference,
  resolveLanguagePreference,
  resolveSupportedLocale,
} from "./language";

describe("language resolution", () => {
  it("accepts only supported preferences", () => {
    expect(isLanguagePreference("system")).toBe(true);
    expect(isLanguagePreference("zh-CN")).toBe(true);
    expect(isLanguagePreference("en-US")).toBe(true);
    expect(isLanguagePreference("fr-FR")).toBe(false);
    expect(isLanguagePreference(null)).toBe(false);
  });

  it("uses the first supported system language and normalizes its region", () => {
    expect(resolveSupportedLocale(["fr-FR", "zh-TW", "en-US"])).toBe(
      "zh-CN",
    );
    expect(resolveSupportedLocale(["en-GB", "zh-CN"])).toBe("en-US");
  });

  it("falls back to English for unsupported system languages", () => {
    expect(resolveSupportedLocale(["fr-FR", "de-DE"])).toBe("en-US");
  });

  it("keeps an explicit language independent of system languages", () => {
    expect(resolveLanguagePreference("zh-CN", ["en-US"])).toBe("zh-CN");
    expect(resolveLanguagePreference("en-US", ["zh-CN"])).toBe("en-US");
  });
});
