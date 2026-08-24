export type AppLocale = "zh-CN" | "en-US";
export type AppLanguagePreference = "system" | AppLocale;

export const LANGUAGE_PREFERENCE_STORAGE_KEY = "look-me:language:v1";

export function isLanguagePreference(
  value: unknown,
): value is AppLanguagePreference {
  return value === "system" || value === "zh-CN" || value === "en-US";
}

export function resolveSupportedLocale(
  languages: readonly string[],
): AppLocale {
  for (const language of languages) {
    const normalized = language.toLowerCase();
    if (normalized === "zh" || normalized.startsWith("zh-")) {
      return "zh-CN";
    }
    if (normalized === "en" || normalized.startsWith("en-")) {
      return "en-US";
    }
  }
  return "en-US";
}

export function resolveLanguagePreference(
  preference: AppLanguagePreference,
  systemLanguages: readonly string[],
): AppLocale {
  return preference === "system"
    ? resolveSupportedLocale(systemLanguages)
    : preference;
}
