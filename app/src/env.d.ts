/// <reference types="vite/client" />

type LookMePetSize = "small" | "standard" | "large";
type LookMeCommand =
  | "pause"
  | "distance"
  | "history:show"
  | "history:hide"
  | "attention:reveal"
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

interface LookMeBridge {
  isDesktop: true;
  setPointerEvents: (enabled: boolean) => void;
  dragWindow: (
    phase: "start" | "move" | "end",
    screenX: number,
    screenY: number,
    handleBounds?: LookMeDragHandleBounds,
  ) => void;
  syncPetSize: (size: LookMePetSize) => void;
  syncPetPersistence: (enabled: boolean) => void;
  syncPetAttention: (attention: LookMePetAttention) => void;
  syncHistoryVisibility: (visible: boolean) => void;
  quit: () => void;
  onCommand: (listener: (command: LookMeCommand) => void) => () => void;
}

interface Window {
  lookMe?: LookMeBridge;
}
