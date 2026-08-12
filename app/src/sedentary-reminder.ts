import type { PostureState } from "./posture-signal";

export interface SedentaryReminderInput {
  now: number;
  monitoring: boolean;
  enabled: boolean;
  postureState: PostureState;
  canPrompt: boolean;
  thresholdMs: number;
}

export class SedentaryReminder {
  private active = false;
  private seatedSince: number | null = null;
  private acknowledged = false;

  update(input: SedentaryReminderInput): boolean {
    if (!input.monitoring || !input.enabled || input.postureState !== "seated") {
      this.active = false;
      this.seatedSince = null;
      this.acknowledged = false;
      return false;
    }

    this.seatedSince ??= input.now;
    if (
      this.active &&
      input.now - this.seatedSince < input.thresholdMs
    ) {
      this.active = false;
    }
    if (
      !this.active &&
      !this.acknowledged &&
      input.canPrompt &&
      input.now - this.seatedSince >= input.thresholdMs
    ) {
      this.active = true;
    }

    return this.active;
  }

  acknowledge(): void {
    this.active = false;
    this.acknowledged = true;
  }
}
