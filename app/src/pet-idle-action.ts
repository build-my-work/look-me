export const PET_IDLE_ACTION_STORAGE_KEY = "look-me:pet-idle-action:v1";

export type PetIdleActionPreference =
  | "auto"
  | "yawn"
  | "clap"
  | "sit"
  | "spin"
  | "off";

export type PetDisplayAction =
  | PetIdleActionPreference
  | "mouth-sync"
  | "mouth-close-sync";

export type PetActionDemo = Extract<
  PetIdleActionPreference,
  "yawn" | "clap" | "sit" | "spin"
>;

const PET_IDLE_ACTIONS = new Set<PetIdleActionPreference>([
  "auto",
  "yawn",
  "clap",
  "sit",
  "spin",
  "off",
]);

export function parsePetIdleActionPreference(
  raw: string | null,
): PetIdleActionPreference {
  return PET_IDLE_ACTIONS.has(raw as PetIdleActionPreference)
    ? (raw as PetIdleActionPreference)
    : "auto";
}

export function resolvePetDisplayAction(input: {
  petActionDemo: PetActionDemo | null;
  mouthOpen: boolean;
  mouthClosing?: boolean;
  cameraSettingsOpen: boolean;
  petActionPreview: PetIdleActionPreference | null;
  idleActionEligible: boolean;
  petIdleAction: PetIdleActionPreference;
}): PetDisplayAction {
  if (input.petActionDemo) {
    return input.petActionDemo;
  }
  if (input.mouthOpen) {
    return "mouth-sync";
  }
  if (input.mouthClosing) {
    return "mouth-close-sync";
  }
  if (input.cameraSettingsOpen && input.petActionPreview) {
    return input.petActionPreview;
  }
  if (!input.idleActionEligible) {
    return "off";
  }
  if (input.petIdleAction === "off") {
    return "off";
  }
  return "auto";
}
