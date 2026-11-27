// The keeper's swing: a wedge that sweeps across the real hit arc (a quarter turn
// around the facing, out to the blade's reach), so what flashes is what can hit.
import Phaser from "phaser";

export const SWING_MS = 180;
/** shared/fight.ts REACH; drawn, never used to decide a hit. */
const REACH = 20;
const HALF_ARC = 50;
const BLADE = 0xf2eaf1;
const EDGE = 0xffe18d;

function turnOf(facing: number): number {
  return [0, 90, 180, 270][facing] ?? 0;
}

/** Draws the swing `age` ms after it began; nothing once it is over. */
export function drawSwing(pen: Phaser.GameObjects.Graphics, x: number, y: number, facing: number, age: number): void {
  if (age < 0 || age >= SWING_MS) return;
  const share = age / SWING_MS;
  const swept = 1 - (1 - share) * (1 - share);
  const from = Phaser.Math.DegToRad(turnOf(facing) - HALF_ARC);
  const lead = Phaser.Math.DegToRad(turnOf(facing) - HALF_ARC + HALF_ARC * 2 * swept);
  const fade = 1 - share;
  pen.fillStyle(BLADE, 0.3 * fade);
  pen.slice(x, y, REACH + 2, from, lead, false).fillPath();
  pen.lineStyle(3, BLADE, 0.95 * fade);
  pen.beginPath().arc(x, y, REACH, from, lead, false).strokePath();
  pen.lineStyle(1, EDGE, fade);
  pen.beginPath().arc(x, y, REACH + 2, Math.max(from, lead - 0.7), lead, false).strokePath();
}
