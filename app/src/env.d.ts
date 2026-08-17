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
}

interface LookMeSystemAvailability {
  screenLocked: boolean;
  systemSuspended: boolean;
}

type LookMeZhihuDirectResult =
  | { ok: true; answer: string }
  | { ok: false; error: { code: string; message: string } };

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
  syncHistoryOpen: (open: boolean) => void;
  syncZhihuDirectOpen: (open: boolean) => void;
  askZhihuDirect: (query: string) => Promise<LookMeZhihuDirectResult>;
  syncPetPersistence: (enabled: boolean) => void;
  syncPetAttention: (attention: LookMePetAttention) => void;
  syncPanelVisibility: (visible: boolean) => void;
  getSystemAvailability: () => Promise<LookMeSystemAvailability>;
  onSystemAvailability: (
    listener: (availability: LookMeSystemAvailability) => void,
  ) => () => void;
  quit: () => void;
  onCommand: (listener: (command: LookMeCommand) => void) => () => void;
}

interface Window {
  lookMe?: LookMeBridge;
}
