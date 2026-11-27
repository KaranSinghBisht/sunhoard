// The anvil's wheel: a pie whose hit slice is exactly the strike's odds, and the turn
// that stops it with the pointer inside the slice the chain chose. Pure maths.

/** `HEAT_PER_FAIL` in programs/sunhoard/src/logic/anvil.rs:19: a miss adds this many points to the next try. */
export const HEAT_PER_FAIL = 5;
/** `SCRAP_BP` in programs/sunhoard/src/logic/anvil.rs:24: a miss returns this share of the input value. */
export const SCRAP_BP = 1_000n;
const BP = 10_000;
/** The pointer never stops closer than this share of a slice to its edge, so the result reads at a glance. */
const EDGE = 0.2;
/** Whole turns the wheel makes while it slows down. */
const TURNS = 4;

export interface Point {
  x: number;
  y: number;
}

/** The hit slice's sweep in degrees, clockwise from twelve o'clock. */
export function hitSweep(oddsBp: number): number {
  return (Math.min(Math.max(oddsBp, 0), BP) / BP) * 360;
}

/** A point on the rim, `angle` degrees clockwise from twelve o'clock. */
export function rimPoint(angle: number, radius: number, centre: number): Point {
  const turn = (angle * Math.PI) / 180;
  return { x: centre + radius * Math.sin(turn), y: centre - radius * Math.cos(turn) };
}

/** The SVG path of the slice from `from` to `to` degrees. */
export function slicePath(from: number, to: number, radius: number, centre: number): string {
  const a = rimPoint(from, radius, centre);
  const b = rimPoint(to, radius, centre);
  const large = to - from > 180 ? 1 : 0;
  return `M${centre} ${centre} L${a.x.toFixed(2)} ${a.y.toFixed(2)} A${radius} ${radius} 0 ${large} 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)} Z`;
}

/**
 * The wheel's own angle that must end under the pointer. The slice is the chain's; where
 * inside it is only for show, since the roll itself is not kept on chain. `unit` is 0..1.
 */
export function restAngle(oddsBp: number, hit: boolean, unit: number): number {
  const sweep = hitSweep(oddsBp);
  const into = EDGE + Math.min(Math.max(unit, 0), 1) * (1 - 2 * EDGE);
  return hit ? sweep * into : sweep + (360 - sweep) * into;
}

/** The clockwise turn, in degrees, that brings `restAngle` under a pointer at twelve o'clock. */
export function stopTurn(oddsBp: number, hit: boolean, unit: number): number {
  return TURNS * 360 - restAngle(oddsBp, hit, unit);
}

/** Which slice sits under the pointer after the wheel has turned `turn` degrees. */
export function sliceUnder(oddsBp: number, turn: number): "hit" | "miss" {
  const under = (((-turn % 360) + 360) % 360);
  return under < hitSweep(oddsBp) ? "hit" : "miss";
}

/** The scrap a miss returns, in Glint hundredths: `scrap` in logic/anvil.rs:77. */
export function scrapBack(inputs: bigint): bigint {
  return (inputs * SCRAP_BP) / BigInt(BP);
}

export type StrikeEnd = "hit" | "miss" | "pending";

interface Held {
  slot: number;
  id: string;
  rarity: number;
  flags: number;
}

/** `FORGING` in state/bits.rs:11: the piece is waiting on its roll. */
export const FORGING = 1 << 7;

/**
 * Reads a strike's end from the pack. A hit leaves the same piece one rarity up; a miss
 * clears its slot (instructions/anvil.rs `consume`); until then it is still forging.
 */
export function strikeEnd(before: Held, slots: Held[]): StrikeEnd {
  const now = slots.find((entry) => entry.slot === before.slot);
  if (!now || now.id !== before.id) return "miss";
  if ((now.flags & FORGING) !== 0) return "pending";
  return now.rarity === before.rarity + 1 ? "hit" : "pending";
}
