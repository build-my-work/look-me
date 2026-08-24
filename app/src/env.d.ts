/// <reference types="vite/client" />

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
  getSystemAvailability: () => Promise<LookMeSystemAvailability>;
  forceLock: () => Promise<LookMeForceLockResult>;
  onSystemAvailability: (
    listener: (availability: LookMeSystemAvailability) => void,
  ) => () => void;
  quit: () => void;
  onCommand: (listener: (command: LookMeCommand) => void) => () => void;
}

interface Window {
  lookMe?: LookMeBridge;
}
