export const PET_CLICK_MOVEMENT_THRESHOLD = 6;

export function isPetClick(
  startedAt: { screenX: number; screenY: number },
  endedAt: { screenX: number; screenY: number },
): boolean {
  return Math.hypot(
    endedAt.screenX - startedAt.screenX,
    endedAt.screenY - startedAt.screenY,
  ) < PET_CLICK_MOVEMENT_THRESHOLD;
}
