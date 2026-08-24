import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import enUS from "../locales/en-US.json";
import zhCN from "../locales/zh-CN.json";
import {
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  isLanguagePreference,
  resolveLanguagePreference,
  type AppLanguagePreference,
  type AppLocale,
} from "./language";

function getBrowserLanguagePreference(): AppLanguagePreference {
  try {
    const stored = window.localStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY);
    return isLanguagePreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function getInitialLanguagePreference(): AppLanguagePreference {
  return window.lookMe?.languagePreference ?? getBrowserLanguagePreference();
}

function getInitialLocale(
  preference: AppLanguagePreference,
): AppLocale {
  return (
    window.lookMe?.locale ??
    resolveLanguagePreference(preference, navigator.languages)
  );
}

const initialLanguagePreference = getInitialLanguagePreference();

void i18next.use(initReactI18next).init({
  resources: {
    "zh-CN": { translation: zhCN },
    "en-US": { translation: enUS },
  },
  lng: getInitialLocale(initialLanguagePreference),
  fallbackLng: "en-US",
  supportedLngs: ["zh-CN", "en-US"],
  interpolation: { escapeValue: false },
  initAsync: false,
});

function updateDocumentLanguage(locale: string) {
  document.documentElement.lang = locale;
  document.title = i18next.t("app.documentTitle");
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute("content", i18next.t("app.metaDescription"));
}

updateDocumentLanguage(i18next.resolvedLanguage ?? "en-US");
i18next.on("languageChanged", updateDocumentLanguage);

export async function applyLanguagePreference(
  preference: AppLanguagePreference,
): Promise<{ preference: AppLanguagePreference; locale: AppLocale }> {
  const bridge = window.lookMe;
  if (bridge) {
    const state = await bridge.setLanguagePreference(preference);
    await i18next.changeLanguage(state.locale);
    return state;
  }

  try {
    window.localStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // Keep the selected language for this session if storage is unavailable.
  }
  const locale = resolveLanguagePreference(preference, navigator.languages);
  await i18next.changeLanguage(locale);
  return { preference, locale };
}

export default i18next;
