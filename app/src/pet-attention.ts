export const PET_ATTENTION_DESCENT_DELAY_MS = 10_000;
export const PET_ATTENTION_DESCENT_DURATION_MS = 15_000;
export const PET_ATTENTION_CRY_DURATION_MS = 5_000;
export const PET_ATTENTION_RECOVERY_MS = 1_600;
export const PET_ATTENTION_COOLDOWN_MS = 25_000;

const RAMPAGE_ROUND_MS = 5_500;
const RAMPAGE_FLIGHT_MS = RAMPAGE_ROUND_MS * 2;
const RAMPAGE_REST_MS = 2_000;
const MAX_ACTIVE_STEP_MS = 250;

export type PetAttentionPhase =
  | "parked"
  | "hidden"
  | "resting"
  | "descending"
  | "crying"
  | "rampage"
  | "recovering"
  | "cooldown";

export interface PetAttentionFrame {
  phase: PetAttentionPhase;
  position: number;
  crying: boolean;
  flying: boolean;
  rail: boolean;
}

export interface PetAttentionInput {
  now: number;
  sensing: boolean;
  parked: boolean;
  held: boolean;
  blinkCount: number;
  reducedMotion: boolean;
}

export function applyPetPersistence(
  frame: PetAttentionFrame,
  persistent: boolean,
): PetAttentionFrame {
  if (!persistent || !["hidden", "cooldown"].includes(frame.phase)) {
    return frame;
  }
  return {
    phase: "resting",
    position: 0,
    crying: false,
    flying: false,
    rail: true,
  };
}

const PARKED_FRAME: PetAttentionFrame = {
  phase: "parked",
  position: 1,
  crying: false,
  flying: false,
  rail: false,
};

const HIDDEN_FRAME: PetAttentionFrame = {
  phase: "hidden",
  position: 0,
  crying: false,
  flying: false,
  rail: true,
};

function getActiveFrame(
  elapsed: number,
  reducedMotion: boolean,
): PetAttentionFrame {
  const cryingStartsAt =
    PET_ATTENTION_DESCENT_DELAY_MS + PET_ATTENTION_DESCENT_DURATION_MS;

  if (reducedMotion) {
    return elapsed < cryingStartsAt
      ? HIDDEN_FRAME
      : {
          phase: "crying",
          position: 0.82,
          crying: true,
          flying: false,
          rail: true,
        };
  }

  if (elapsed < PET_ATTENTION_DESCENT_DELAY_MS) {
    return HIDDEN_FRAME;
  }

  if (elapsed < cryingStartsAt) {
    const linearProgress =
      (elapsed - PET_ATTENTION_DESCENT_DELAY_MS) /
      PET_ATTENTION_DESCENT_DURATION_MS;
    const easedProgress = (1 - Math.cos(Math.PI * linearProgress)) / 2;
    return {
      phase: "descending",
      position: easedProgress,
      crying: false,
      flying: false,
      rail: true,
    };
  }

  const rampageStartsAt = cryingStartsAt + PET_ATTENTION_CRY_DURATION_MS;
  if (elapsed < rampageStartsAt) {
    return {
      phase: "crying",
      position: 1,
      crying: true,
      flying: false,
      rail: true,
    };
  }

  const cycleElapsed =
    (elapsed - rampageStartsAt) % (RAMPAGE_FLIGHT_MS + RAMPAGE_REST_MS);
  if (cycleElapsed >= RAMPAGE_FLIGHT_MS) {
    return {
      phase: "rampage",
      position: 1,
      crying: true,
      flying: false,
      rail: true,
    };
  }

  const roundProgress = (cycleElapsed % RAMPAGE_ROUND_MS) / RAMPAGE_ROUND_MS;
  return {
    phase: "rampage",
    position: (1 + Math.cos(Math.PI * 2 * roundProgress)) / 2,
    crying: true,
    flying: true,
    rail: true,
  };
}

export class PetAttentionController {
  private lastNow: number | null = null;
  private lastBlinkCount = 0;
  private wasSensing = false;
  private activeElapsed = 0;
  private cooldownRemaining = 0;
  private recoveryElapsed: number | null = null;
  private recoveryFromPosition = 0;
  private lastRailFrame: PetAttentionFrame = HIDDEN_FRAME;

  update(input: PetAttentionInput): PetAttentionFrame {
    let elapsedSinceUpdate = this.lastNow === null
      ? 0
      : Math.max(0, Math.min(MAX_ACTIVE_STEP_MS, input.now - this.lastNow));
    this.lastNow = input.now;

    const confirmedBlink = input.blinkCount > this.lastBlinkCount;
    this.lastBlinkCount = input.blinkCount;

    if (!input.sensing) {
      this.wasSensing = false;
      this.activeElapsed = 0;
      this.cooldownRemaining = 0;
      this.recoveryElapsed = null;
      this.recoveryFromPosition = 0;
      this.lastRailFrame = HIDDEN_FRAME;
      return PARKED_FRAME;
    }

    if (!this.wasSensing) {
      this.wasSensing = true;
      this.activeElapsed = 0;
      this.cooldownRemaining = 0;
      this.recoveryElapsed = null;
      this.recoveryFromPosition = 0;
      this.lastRailFrame = HIDDEN_FRAME;
      elapsedSinceUpdate = 0;
    }

    if (confirmedBlink) {
      this.activeElapsed = 0;
      this.cooldownRemaining = PET_ATTENTION_COOLDOWN_MS;
      if (
        !input.reducedMotion &&
        !["hidden", "cooldown"].includes(this.lastRailFrame.phase)
      ) {
        this.recoveryElapsed = 0;
        this.recoveryFromPosition = this.lastRailFrame.position;
      } else {
        this.recoveryElapsed = null;
        this.recoveryFromPosition = 0;
        this.lastRailFrame = {
          ...HIDDEN_FRAME,
          phase: "cooldown",
        };
      }
    }

    if (input.parked) {
      return PARKED_FRAME;
    }

    if (input.held) {
      return this.lastRailFrame;
    }

    if (this.recoveryElapsed !== null) {
      this.recoveryElapsed += elapsedSinceUpdate;
      if (this.recoveryElapsed < PET_ATTENTION_RECOVERY_MS) {
        const progress = this.recoveryElapsed / PET_ATTENTION_RECOVERY_MS;
        const easedProgress = 1 - (1 - progress) ** 3;
        this.lastRailFrame = {
          phase: "recovering",
          position:
            this.recoveryFromPosition * (1 - easedProgress),
          crying: false,
          flying: false,
          rail: true,
        };
        return this.lastRailFrame;
      }
      this.recoveryElapsed = null;
      this.recoveryFromPosition = 0;
      this.lastRailFrame = {
        ...HIDDEN_FRAME,
        phase: "cooldown",
      };
      return this.lastRailFrame;
    }

    if (this.cooldownRemaining > 0) {
      this.cooldownRemaining = Math.max(
        0,
        this.cooldownRemaining - elapsedSinceUpdate,
      );
      if (this.cooldownRemaining > 0) {
        this.lastRailFrame = {
          ...HIDDEN_FRAME,
          phase: "cooldown",
        };
        return this.lastRailFrame;
      }
      this.activeElapsed = 0;
    }

    this.activeElapsed += elapsedSinceUpdate;
    this.lastRailFrame = getActiveFrame(
      this.activeElapsed,
      input.reducedMotion,
    );
    return this.lastRailFrame;
  }
}
