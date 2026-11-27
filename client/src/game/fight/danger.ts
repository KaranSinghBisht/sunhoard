// A telegraphed blow: a red ring that fills from its middle as the blow comes due,
// so the eye reads "get out" and "how soon" at once.
import type Phaser from "phaser";

const RED = 0xe0394c;
const HOT = 0xff6a5a;

/** `share` runs 0 → 1 as the telegraph counts down to the blow. */
export function drawDanger(pen: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, share: number, time: number): void {
  const due = Math.max(0, Math.min(1, share));
  const pulse = 0.5 + 0.5 * Math.sin(time / 40);
  pen.fillStyle(RED, 0.14 + 0.1 * pulse).fillCircle(x, y, radius);
  pen.fillStyle(RED, 0.3 + 0.25 * due).fillCircle(x, y, Math.max(2, radius * due));
  pen.lineStyle(2, HOT, 0.75 + 0.25 * pulse).strokeCircle(x, y, radius);
}
