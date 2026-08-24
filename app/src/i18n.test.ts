import i18next from "i18next";
import { describe, expect, it } from "vitest";
import enUS from "../locales/en-US.json";
import zhCN from "../locales/zh-CN.json";

function getLeafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value).flatMap(([key, child]) =>
    getLeafKeys(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe("translation resources", () => {
  it("keeps the Chinese and English key sets in sync", () => {
    expect(getLeafKeys(zhCN).sort()).toEqual(getLeafKeys(enUS).sort());
  });

  it("contains no empty leaf values", () => {
    for (const resource of [zhCN, enUS]) {
      for (const key of getLeafKeys(resource)) {
        const value = key
          .split(".")
          .reduce<unknown>(
            (current, part) =>
              typeof current === "object" && current !== null
                ? (current as Record<string, unknown>)[part]
                : undefined,
            resource,
          );
        expect(typeof value === "string" && value.trim().length > 0).toBe(true);
      }
    }
  });

  it("interpolates and pluralizes representative UI copy in both locales", async () => {
    const instance = i18next.createInstance();
    await instance.init({
      resources: {
        "zh-CN": { translation: zhCN },
        "en-US": { translation: enUS },
      },
      lng: "en-US",
      fallbackLng: "en-US",
      supportedLngs: ["zh-CN", "en-US"],
      initAsync: false,
    });

    expect(
      instance.t("history.metricCount", { metric: "Blink", count: 1 }),
    ).toBe("Blink 1 time");
    expect(instance.t("status.outsideScheduleWithTime", { time: "09:00" })).toBe(
      "Outside schedule · resumes at 09:00",
    );

    await instance.changeLanguage("zh-CN");
    expect(
      instance.t("history.metricCount", { metric: "眨眼", count: 2 }),
    ).toBe("眨眼 2 次");
    expect(instance.t("status.outsideScheduleWithTime", { time: "09:00" })).toBe(
      "时段外 · 09:00 恢复",
    );
  });
});
