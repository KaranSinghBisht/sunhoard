export const STEP_UNITS = 80;
export const POST_GAP_MS = 1000;
export const GATHER_RANGE = 24;

export interface Pace {
  posted: boolean;
  x: number;
  y: number;
  at: number;
}

export function nextPost(pace: Pace, x: number, y: number, now: number): { x: number; y: number } | null {
  if (!pace.posted) return { x, y };
  if (now - pace.at < POST_GAP_MS) return null;
  return stepToward(pace.x, pace.y, x, y, STEP_UNITS);
}

export function stepToward(fromX: number, fromY: number, toX: number, toY: number, max: number): { x: number; y: number } {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const distance = Math.hypot(dx, dy);
  if (distance === 0) return { x: fromX, y: fromY };
  const scale = distance <= max ? 1 : max / distance;
  let x = fromX + Math.trunc(dx * scale);
  let y = fromY + Math.trunc(dy * scale);
  const left = x - fromX;
  const down = y - fromY;
  if (left * left + down * down > max * max) {
    const slower = (max - 1) / distance;
    x = fromX + Math.trunc(dx * slower);
    y = fromY + Math.trunc(dy * slower);
  }
  return { x, y };
}

export function inRange(x: number, y: number, nodeX: number, nodeY: number): boolean {
  const dx = x - nodeX;
  const dy = y - nodeY;
  return dx * dx + dy * dy <= GATHER_RANGE * GATHER_RANGE;
}
