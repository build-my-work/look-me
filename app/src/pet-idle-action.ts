export const PET_IDLE_ACTION_STORAGE_KEY = "look-me:pet-idle-action:v1";

export type PetIdleActionPreference =
  | "auto"
  | "yawn"
  | "clap"
  | "sit"
  | "spin"
  | "off";

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
