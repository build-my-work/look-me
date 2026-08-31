/// <reference types="vite/client" />

type AppLanguagePreference = import("./language").AppLanguagePreference;
type AppLocale = import("./language").AppLocale;

type LookMePetSize = "small" | "standard" | "large";
type LookMeCommand =
  | "distance"
  | "panel:show"
  | "panel:show:left"
  | "panel:show:right"
  | "panel:hide"
  | "camera-settings:show"
  | "monitoring:on"
  | "monitoring:off"
  | "pet-persistent:on"
  | "pet-persistent:off"
  | `pet-side:${"left" | "right"}`
  | `pet-offset-y:${number}`
  | `pet-size:${LookMePetSize}`;

interface LookMePetAttention {
  phase:
    | "parked"
    | "hidden"
    | "resting"
    | "descending"
    | "crying"
    | "rampage"
    | "recovering"
    | "cooldown";
  position: number;
  rail: boolean;
}

interface LookMeDragHandleBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  petTop?: number;
}

interface LookMeSystemAvailability {
  screenLocked: boolean;
  systemSuspended: boolean;
  lockCycle: number;
}

interface LookMeForceLockResult {
  status: "locked" | "failed" | "timeout";
}

interface LookMeBridge {
  isDesktop: true;
  languagePreference: AppLanguagePreference;
  locale: AppLocale;
  setPointerEvents: (enabled: boolean) => void;
  dragWindow: (
    phase: "start" | "move" | "end",
    screenX: number,
    screenY: number,
    handleBounds?: LookMeDragHandleBounds,
  ) => void;
  openSettings: () => void;
  syncPetSize: (size: LookMePetSize) => void;
  syncMonitoringEnabled: (enabled: boolean) => void;
  syncCameraSettingsOpen: (open: boolean) => void;
  syncCameraSettingsHeight: (height: number) => void;
  syncHistoryOpen: (open: boolean) => void;
  syncPetPersistence: (enabled: boolean) => void;
  syncPetAttention: (attention: LookMePetAttention) => void;
  syncPanelVisibility: (visible: boolean) => void;
  syncLockCountdown: (seconds: number | null) => void;
  getSystemAvailability: () => Promise<LookMeSystemAvailability>;
  forceLock: () => Promise<LookMeForceLockResult>;
  setLanguagePreference: (
    preference: AppLanguagePreference,
  ) => Promise<{ preference: AppLanguagePreference; locale: AppLocale }>;
  onLocaleChanged: (
    listener: (state: {
      preference: AppLanguagePreference;
      locale: AppLocale;
    }) => void,
  ) => () => void;
  onSystemAvailability: (
    listener: (availability: LookMeSystemAvailability) => void,
  ) => () => void;
  onLockCountdown: (
    listener: (seconds: number | null) => void,
  ) => () => void;
  quit: () => void;
  onCommand: (listener: (command: LookMeCommand) => void) => () => void;
}

interface Window {
  lookMe?: LookMeBridge;
}
